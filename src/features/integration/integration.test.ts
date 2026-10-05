import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dispatch, handleApi, type Client, type Delivery, type Store } from "./integration-api";
import { decodeCursor, encodeCursor, minimizePayload, redactSecret, sha256Hex, signWebhook, verifyWebhook } from "./integration-core";
import { openApiDocument } from "./openapi";

const KEY_A = "sgk_" + "a".repeat(64);
const KEY_B = "sgk_" + "b".repeat(64);

async function memory(opts: { scopesA?: string[]; schoolsA?: string[] | null; rate?: number } = {}) {
  const clients: Record<string, Client> = {
    A: { id: "A", scopes: opts.scopesA ?? ["escolas:ler", "webhooks:ler", "webhooks:testar"], school_ids: opts.schoolsA ?? null, rate_limit_per_minute: opts.rate ?? 60, active: true },
    B: { id: "B", scopes: ["webhooks:ler"], school_ids: null, rate_limit_per_minute: 60, active: true },
  };
  const keys = new Map([[await sha256Hex(KEY_A), "A"], [await sha256Hex(KEY_B), "B"]]);
  const audit: any[] = [];
  const deliveries: (Delivery & { next: string })[] = [];
  const subs = [{ id: "sA", client_id: "A", url: "https://a.example/h", events: ["integracao.teste"], secret: "whsec_A", active: true }, { id: "sB", client_id: "B", url: "https://b.example/h", events: ["integracao.teste"], secret: "whsec_B", active: true }];
  const schools = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, official_name: `Escola ${i}` }));
  const store: Store = {
    async findKey(h) { const c = keys.get(h); return c ? { keyId: `k${c}`, client: clients[c]! } : null; },
    async countRecent(c) { return audit.filter((a) => a.client_id === c).length; },
    async findIdempotent(c, r, k) { const a = audit.find((x) => x.client_id === c && x.route === r && x.idempotency_key === k && x.status < 300); return a ? { status: a.status, body: a.response_body } : null; },
    async audit(row) { audit.push(row); },
    async listSchools(after, limit, allowed) { return schools.filter((s) => (!after || s.id > after) && (!allowed || allowed.includes(s.id))).slice(0, limit); },
    async listPublications() { return []; },
    async listDeliveries(c, after, limit) { const mine = subs.filter((s) => s.client_id === c).map((s) => s.id); return deliveries.filter((d) => mine.includes(d.subscription_id) && (!after || d.id > after)).slice(0, limit); },
    async subscriptionsFor(c, e) { return subs.filter((s) => s.client_id === c && s.events.includes(e)); },
    async enqueue(sub, ev, type, payload) { const ex = deliveries.find((d) => d.subscription_id === sub && d.event_id === ev); if (ex) return { id: ex.id, created: false }; const id = `d${deliveries.length}`; deliveries.push({ id, subscription_id: sub, event_id: ev, event_type: type, payload, status: "pendente", attempts: 0, last_http_status: null, updated_at: "t", next: "1970" }); return { id, created: true }; },
    async dueDeliveries(ids, now) { return deliveries.filter((d) => ["pendente", "falhou"].includes(d.status) && d.next <= now && (!ids || ids.includes(d.id))).map((d) => { const s = subs.find((x) => x.id === d.subscription_id)!; return { ...d, url: s.url, secret: s.secret }; }); },
    async markDelivery(id, p) { const d = deliveries.find((x) => x.id === id)!; Object.assign(d, p, { next: p.next_attempt_at }); },
  };
  return { store, audit, deliveries, clients };
}

const sent: { url: string; headers: Record<string, string>; body: string }[] = [];
const deps = (status = 200) => ({ now: () => new Date("2026-10-05T10:00:00Z"), newId: () => "x", fetch: (async (url: string, init: RequestInit) => { sent.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) }); return new Response(null, { status }); }) as unknown as typeof fetch });
const req = (path: string, key?: string, init: RequestInit = {}) => new Request(`https://x/api/public${path}`, { ...init, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...(init.headers as Record<string, string> ?? {}) } });

describe("API de integração v1", () => {
  it("sem chave, chave malformada e chave desconhecida recebem erros estáveis", async () => {
    const { store } = await memory();
    expect((await handleApi(req("/v1/schools"), "/v1/schools", store, deps(), "r")).body).toMatchObject({ error: { code: "auth.missing" } });
    expect((await handleApi(req("/v1/schools", "sgk_x"), "/v1/schools", store, deps(), "r")).status).toBe(401);
    const r = await handleApi(req("/v1/schools", "sgk_" + "c".repeat(64)), "/v1/schools", store, deps(), "r");
    expect(r.body).toMatchObject({ error: { code: "auth.invalid" } });
  });

  it("scope insuficiente é recusado e auditado", async () => {
    const { store, audit } = await memory();
    const r = await handleApi(req("/v1/schools", KEY_B), "/v1/schools", store, deps(), "r");
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ error: { code: "scope.insufficient" } });
    expect(audit.at(-1)).toMatchObject({ client_id: "B", status: 403, error_code: "scope.insufficient" });
  });

  it("paginação por cursor percorre tudo sem repetir e recusa cursor adulterado", async () => {
    const { store } = await memory();
    const seen: string[] = []; let cursor: string | null = null;
    do {
      const r: any = await handleApi(req(`/v1/schools?limit=3${cursor ? `&cursor=${cursor}` : ""}`, KEY_A), "/v1/schools", store, deps(), "r");
      seen.push(...r.body.data.map((s: any) => s.id)); cursor = r.body.next_cursor;
    } while (cursor);
    expect(seen).toEqual(["s0", "s1", "s2", "s3", "s4", "s5", "s6"]);
    expect((await handleApi(req("/v1/schools?cursor=%%%", KEY_A), "/v1/schools", store, deps(), "r")).body).toMatchObject({ error: { code: "cursor.invalid" } });
    expect((await handleApi(req("/v1/schools?limit=999", KEY_A), "/v1/schools", store, deps(), "r")).status).toBe(400);
    expect(decodeCursor(encodeCursor("s3"))).toEqual({ ok: true, key: "s3" });
  });

  it("escopo de escola do cliente limita o resultado", async () => {
    const { store } = await memory({ schoolsA: ["s2"] });
    const r: any = await handleApi(req("/v1/schools", KEY_A), "/v1/schools", store, deps(), "r");
    expect(r.body.data.map((s: any) => s.id)).toEqual(["s2"]);
    const none: any = await handleApi(req("/v1/schools", KEY_A), "/v1/schools", (await memory({ schoolsA: [] })).store, deps(), "r");
    expect(none.body.data).toEqual([]);
  });

  it("rate limit por cliente devolve 429 com Retry-After", async () => {
    const { store } = await memory({ rate: 2 });
    await handleApi(req("/v1/schools", KEY_A), "/v1/schools", store, deps(), "r");
    await handleApi(req("/v1/schools", KEY_A), "/v1/schools", store, deps(), "r");
    const r = await handleApi(req("/v1/schools", KEY_A), "/v1/schools", store, deps(), "r");
    expect(r.status).toBe(429);
    expect(r.headers?.["retry-after"]).toBe("60");
  });

  it("escrita exige Idempotency-Key e repetição devolve a mesma resposta sem duplicar entrega", async () => {
    const { store, deliveries } = await memory();
    const post = (k?: string) => req("/v1/webhooks/test", KEY_A, { method: "POST", headers: k ? { "idempotency-key": k } : {} });
    expect((await handleApi(post(), "/v1/webhooks/test", store, deps(), "r")).body).toMatchObject({ error: { code: "idempotency.required" } });
    const first = await handleApi(post("chave-0001"), "/v1/webhooks/test", store, deps(), "r1");
    const again = await handleApi(post("chave-0001"), "/v1/webhooks/test", store, deps(), "r2");
    expect(again.body).toEqual(first.body);
    expect(again.headers?.["idempotent-replayed"]).toBe("true");
    expect(deliveries).toHaveLength(1);
  });

  it("IDOR: cliente só vê entregas das próprias assinaturas", async () => {
    const { store } = await memory();
    await store.enqueue("sB", "evt_b", "integracao.teste", {});
    const r: any = await handleApi(req("/v1/webhook-deliveries", KEY_A), "/v1/webhook-deliveries", store, deps(), "r");
    expect(r.body.data).toEqual([]);
    const b: any = await handleApi(req("/v1/webhook-deliveries", KEY_B), "/v1/webhook-deliveries", store, deps(), "r");
    expect(b.body.data).toHaveLength(1);
    expect(JSON.stringify(b.body)).not.toContain("whsec_");
  });

  it("não existe rota genérica: caminho fora do registro é 404", async () => {
    const { store } = await memory();
    expect((await handleApi(req("/v1/sql", KEY_A), "/v1/sql", store, deps(), "r")).status).toBe(404);
  });
});

describe("webhooks", () => {
  it("assinatura válida passa; corpo alterado, segredo errado, cabeçalho ausente ou antigo falham", async () => {
    const sig = await signWebhook("whsec_x", '{"a":1}', 1000);
    expect(await verifyWebhook("whsec_x", '{"a":1}', sig, 1010)).toBe(true);
    expect(await verifyWebhook("whsec_x", '{"a":2}', sig, 1010)).toBe(false);
    expect(await verifyWebhook("whsec_y", '{"a":1}', sig, 1010)).toBe(false);
    expect(await verifyWebhook("whsec_x", '{"a":1}', null, 1010)).toBe(false);
    expect(await verifyWebhook("whsec_x", '{"a":1}', sig, 1000 + 301)).toBe(false); // replay tardio
  });

  it("entrega assinada; falha retentável reagenda e esgotada vira dead-letter; replay reenvia", async () => {
    const { store, deliveries } = await memory();
    await store.enqueue("sA", "evt_1", "integracao.teste", { message: "teste" });
    sent.length = 0;
    await dispatch(store, deps(200), null);
    expect(deliveries[0]!.status).toBe("entregue");
    expect(await verifyWebhook("whsec_A", sent[0]!.body, sent[0]!.headers["x-sigem-signature"]!, Math.floor(new Date("2026-10-05T10:00:00Z").getTime() / 1000))).toBe(true);

    await store.enqueue("sA", "evt_2", "integracao.teste", {});
    await dispatch(store, deps(503), null);
    expect(deliveries[1]).toMatchObject({ status: "falhou", attempts: 1 });
    Object.assign(deliveries[1]!, { attempts: 5, next: "1970" });
    await dispatch(store, deps(503), null);
    expect(deliveries[1]!.status).toBe("dead-letter");
    await dispatch(store, deps(200), null);
    expect(deliveries[1]!.status).toBe("dead-letter"); // não reenvia sozinho
    Object.assign(deliveries[1]!, { status: "pendente", attempts: 0, next: "1970" }); // efeito de integration_replay_delivery
    await dispatch(store, deps(200), null);
    expect(deliveries[1]!.status).toBe("entregue");
  });

  it("4xx não retentável vai direto a dead-letter; evento duplicado não duplica entrega", async () => {
    const { store, deliveries } = await memory();
    await store.enqueue("sA", "evt_x", "integracao.teste", {});
    expect((await store.enqueue("sA", "evt_x", "integracao.teste", {})).created).toBe(false);
    await dispatch(store, deps(410), null);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.status).toBe("dead-letter");
  });

  it("payload minimizado e segredo nunca exibido inteiro", () => {
    expect(minimizePayload("publicacao.publicada", { slug: "a", kind: "k", version: 1, cpf: "x", nome: "y" })).toEqual({ slug: "a", kind: "k", version: 1 });
    expect(redactSecret("whsec_abcdef123456")).toBe("…3456");
    expect(redactSecret(null)).toBe("");
  });
});

describe("contrato no banco e documentação", () => {
  const sql = readFileSync("drizzle/migrations/0091_integration_api_webhooks.sql", "utf8");
  it("tabelas sem acesso de anon/authenticated, chave só como hash, visão administrativa sem segredo inteiro", () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.%I FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/key_hash text NOT NULL UNIQUE/);
    expect(sql).not.toMatch(/'secret',s\.secret/);
    expect(sql).toMatch(/'secret_hint','…'\|\|right\(s\.secret,4\)/);
    expect(sql).toMatch(/has_network_capability\('administrar-integracoes'\)/);
  });
  it("OpenAPI lista só os endpoints registrados, com scopes", () => {
    const doc = openApiDocument("https://x/api/public");
    expect(Object.keys(doc.paths).sort()).toEqual(["/v1/publications", "/v1/schools", "/v1/webhook-deliveries", "/v1/webhooks/test"]);
    expect((doc.paths["/v1/schools"] as any).get["x-required-scopes"]).toEqual(["escolas:ler"]);
  });
});
