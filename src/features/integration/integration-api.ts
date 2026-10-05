// Pipeline da API v1 sobre uma Store abstrata (o adaptador real usa o banco no servidor).
// Ordem fixa: autenticação de máquina → cliente ativo → scope → rate limit → idempotência → handler → trilha.
import {
  apiError, decodeCursor, hasScopes, IDEMPOTENCY_KEY, pageOf, parseLimit, rateLimitDecision, sha256Hex,
  minimizePayload, nextAttemptDelaySec, isRetryableStatus, signWebhook, type EventType, type Scope,
} from "./integration-core";

export type Client = { id: string; scopes: string[]; school_ids: string[] | null; rate_limit_per_minute: number; active: boolean };
export type Delivery = { id: string; subscription_id: string; event_id: string; event_type: string; payload: Record<string, unknown>; status: string; attempts: number; last_http_status: number | null; updated_at: string };
export type Subscription = { id: string; client_id: string; url: string; events: string[]; secret: string; active: boolean };

export interface Store {
  findKey(hash: string): Promise<{ keyId: string; client: Client } | null>;
  countRecent(clientId: string, sinceIso: string): Promise<number>;
  findIdempotent(clientId: string, route: string, key: string): Promise<{ status: number; body: unknown } | null>;
  audit(row: { client_id: string | null; key_id: string | null; method: string; route: string; status: number; error_code: string | null; idempotency_key: string | null; response_body: unknown; request_id: string }): Promise<void>;
  listSchools(afterId: string | null, limit: number, allowed: string[] | null): Promise<{ id: string; official_name: string }[]>;
  listPublications(): Promise<{ slug: string; kind: string; title: string; published_at: string; version: number }[]>;
  listDeliveries(clientId: string, afterId: string | null, limit: number): Promise<Delivery[]>;
  subscriptionsFor(clientId: string, event: EventType): Promise<Subscription[]>;
  enqueue(subId: string, eventId: string, type: EventType, payload: Record<string, unknown>): Promise<{ id: string; created: boolean }>;
  dueDeliveries(ids: string[] | null, nowIso: string, limit: number): Promise<(Delivery & { url: string; secret: string })[]>;
  markDelivery(id: string, patch: { status: string; attempts: number; next_attempt_at: string; last_http_status: number | null; last_error: string | null }): Promise<void>;
}

export type ApiResult = { status: number; body: unknown; headers?: Record<string, string> };
type Ctx = { client: Client; keyId: string; requestId: string; url: URL; body: unknown; idempotencyKey: string | null };

export type Endpoint = {
  method: "GET" | "POST";
  route: string;
  scopes: Scope[];
  write?: boolean;
  summary: string;
  run: (ctx: Ctx, store: Store, deps: Deps) => Promise<ApiResult>;
};
export type Deps = { now: () => Date; fetch: typeof fetch; newId: () => string };

function page(ctx: Ctx) {
  const limit = parseLimit(ctx.url.searchParams.get("limit"));
  const cursor = decodeCursor(ctx.url.searchParams.get("cursor"));
  return { limit, cursor };
}

export const ENDPOINTS: Endpoint[] = [
  {
    method: "GET", route: "/v1/schools", scopes: ["escolas:ler"], summary: "Unidades autorizadas ao cliente (id e nome oficial vigente).",
    run: async (ctx, store) => {
      const { limit, cursor } = page(ctx);
      if (limit === null) return apiError("request.invalid", ctx.requestId, "limit deve estar entre 1 e 200");
      if (!cursor.ok) return apiError("cursor.invalid", ctx.requestId);
      const rows = await store.listSchools(cursor.key, limit + 1, ctx.client.school_ids);
      return { status: 200, body: { ...pageOf(rows, limit, (r) => r.id), api_version: "v1" } };
    },
  },
  {
    method: "GET", route: "/v1/publications", scopes: ["publicacoes:ler"], summary: "Conteúdos publicados no portal público.",
    run: async (ctx, store) => {
      const { limit, cursor } = page(ctx);
      if (limit === null) return apiError("request.invalid", ctx.requestId, "limit deve estar entre 1 e 200");
      if (!cursor.ok) return apiError("cursor.invalid", ctx.requestId);
      const all = (await store.listPublications()).sort((a, b) => a.slug.localeCompare(b.slug));
      const rest = cursor.key === null ? all : all.filter((p) => p.slug > cursor.key!);
      return { status: 200, body: { ...pageOf(rest.slice(0, limit + 1), limit, (r) => r.slug), api_version: "v1" } };
    },
  },
  {
    method: "GET", route: "/v1/webhook-deliveries", scopes: ["webhooks:ler"], summary: "Estado das entregas de webhook do próprio cliente.",
    run: async (ctx, store) => {
      const { limit, cursor } = page(ctx);
      if (limit === null) return apiError("request.invalid", ctx.requestId, "limit deve estar entre 1 e 200");
      if (!cursor.ok) return apiError("cursor.invalid", ctx.requestId);
      const rows = await store.listDeliveries(ctx.client.id, cursor.key, limit + 1);
      const shaped = rows.map((d) => ({ id: d.id, event_id: d.event_id, event_type: d.event_type, status: d.status, attempts: d.attempts, last_http_status: d.last_http_status, updated_at: d.updated_at }));
      return { status: 200, body: { ...pageOf(shaped, limit, (r) => r.id), api_version: "v1" } };
    },
  },
  {
    method: "POST", route: "/v1/webhooks/test", scopes: ["webhooks:testar"], write: true, summary: "Enfileira integracao.teste para as assinaturas do próprio cliente.",
    run: async (ctx, store, deps) => {
      const eventId = `evt_${ctx.idempotencyKey}`;
      const subs = await store.subscriptionsFor(ctx.client.id, "integracao.teste");
      const ids: string[] = [];
      for (const s of subs) ids.push((await store.enqueue(s.id, eventId, "integracao.teste", minimizePayload("integracao.teste", { message: "teste" }))).id);
      if (ids.length) await dispatch(store, deps, ids);
      return { status: 202, body: { event_id: eventId, deliveries: ids.length, api_version: "v1" } };
    },
  },
];

export function findEndpoint(method: string, route: string) {
  return ENDPOINTS.find((e) => e.method === method && e.route === route) ?? null;
}

export async function handleApi(request: Request, route: string, store: Store, deps: Deps, requestId: string): Promise<ApiResult> {
  const url = new URL(request.url);
  let client: Client | null = null;
  let keyId: string | null = null;
  const idemHeader = request.headers.get("idempotency-key");
  const finish = async (r: ApiResult, code: string | null = null): Promise<ApiResult> => {
    await store.audit({ client_id: client?.id ?? null, key_id: keyId, method: request.method, route, status: r.status, error_code: code, idempotency_key: idemHeader && r.status < 300 ? idemHeader : null, response_body: r.status < 300 && idemHeader ? r.body : null, request_id: requestId });
    return { ...r, headers: { ...(r.headers ?? {}), "x-request-id": requestId, "cache-control": "no-store" } };
  };
  const fail = (code: Parameters<typeof apiError>[0], msg?: string, headers?: Record<string, string>) => {
    const e = apiError(code, requestId, msg);
    return finish(headers ? { ...e, headers } : e, code);
  };

  const ep = findEndpoint(request.method, route);
  if (!ep) return fail("resource.not-found");

  const auth = request.headers.get("authorization");
  const m = auth ? /^Bearer (sgk_[a-f0-9]{64})$/.exec(auth) : null;
  if (!auth) return fail("auth.missing");
  if (!m) return fail("auth.invalid");
  const found = await store.findKey(await sha256Hex(m[1]!));
  if (!found) return fail("auth.invalid");
  client = found.client; keyId = found.keyId;
  if (!client.active) return fail("auth.client-inactive");
  if (!hasScopes(client.scopes, ep.scopes)) return fail("scope.insufficient", `requer ${ep.scopes.join(", ")}`);

  const since = new Date(deps.now().getTime() - 60_000).toISOString();
  const rl = rateLimitDecision(await store.countRecent(client.id, since), client.rate_limit_per_minute);
  if (!rl.allowed) return fail("rate.limited", undefined, { "retry-after": String(rl.retryAfter) });

  let body: unknown = null;
  if (ep.write) {
    if (!idemHeader || !IDEMPOTENCY_KEY.test(idemHeader)) return fail("idempotency.required", "Idempotency-Key obrigatório (8–128 caracteres)");
    const prior = await store.findIdempotent(client.id, route, idemHeader);
    if (prior) return { status: prior.status, body: prior.body, headers: { "x-request-id": requestId, "idempotent-replayed": "true", "cache-control": "no-store" } };
    const text = await request.text();
    if (text) { try { body = JSON.parse(text); } catch { return fail("request.invalid", "corpo JSON inválido"); } }
  }
  try {
    const r = await ep.run({ client, keyId, requestId, url, body, idempotencyKey: idemHeader }, store, deps);
    const code = r.status >= 400 ? ((r.body as { error?: { code?: string } })?.error?.code ?? null) : null;
    return finish(r, code);
  } catch {
    return fail("internal.error");
  }
}

/** Uma tentativa para cada entrega devida; falha retentável reagenda, esgotada vira dead-letter. */
export async function dispatch(store: Store, deps: Deps, ids: string[] | null, limit = 6) {
  const now = deps.now();
  const due = await store.dueDeliveries(ids, now.toISOString(), limit);
  const results: { id: string; status: string }[] = [];
  for (const d of due) {
    const body = JSON.stringify({ id: d.event_id, type: d.event_type, created_at: d.updated_at, api_version: "v1", data: d.payload });
    const ts = Math.floor(now.getTime() / 1000);
    let http: number | null = null; let err: string | null = null;
    try {
      const r = await deps.fetch(d.url, { method: "POST", headers: { "content-type": "application/json", "x-sigem-event-id": d.event_id, "x-sigem-signature": await signWebhook(d.secret, body, ts) }, body, signal: AbortSignal.timeout(10_000), redirect: "manual" });
      http = r.status;
    } catch (e) { err = e instanceof Error ? e.name : "erro"; }
    const attempts = d.attempts + 1;
    let status: string; let next = now;
    if (http !== null && http >= 200 && http < 300) status = "entregue";
    else {
      const delay = isRetryableStatus(http) ? nextAttemptDelaySec(attempts) : null;
      status = delay === null ? "dead-letter" : "falhou";
      if (delay !== null) next = new Date(now.getTime() + delay * 1000);
      err ??= `http ${http}`;
    }
    await store.markDelivery(d.id, { status, attempts, next_attempt_at: next.toISOString(), last_http_status: http, last_error: status === "entregue" ? null : err });
    results.push({ id: d.id, status });
  }
  return results;
}
