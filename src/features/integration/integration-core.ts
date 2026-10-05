// Núcleo puro da API de integração v1: scopes, erros estáveis, cursores, limites,
// assinatura de webhooks, minimização de payload e retentativas. Sem I/O.

export const API_VERSION = "v1" as const;

/** Scopes explícitos e mínimos. Nenhum dá acesso a dado de estudante, servidor ou nota. */
export const SCOPES = {
  "escolas:ler": "Lista identificador e nome oficial vigente das unidades autorizadas ao cliente.",
  "publicacoes:ler": "Lista conteúdos já publicados no portal público.",
  "webhooks:ler": "Lista o estado das entregas de webhook do próprio cliente.",
  "webhooks:testar": "Dispara o evento integracao.teste para as assinaturas do próprio cliente.",
} as const;
export type Scope = keyof typeof SCOPES;

/** Catálogo explícito de eventos publicáveis e os únicos campos que cada um pode levar. */
export const EVENT_CATALOG = {
  "integracao.teste": { fields: ["message"] },
  "publicacao.publicada": { fields: ["slug", "kind", "version"] },
} as const;
export type EventType = keyof typeof EVENT_CATALOG;

export const ERROR_CODES = {
  "auth.missing": 401,
  "auth.invalid": 401,
  "auth.client-inactive": 403,
  "scope.insufficient": 403,
  "rate.limited": 429,
  "request.invalid": 400,
  "cursor.invalid": 400,
  "idempotency.required": 400,
  "idempotency.conflict": 409,
  "resource.not-found": 404,
  "internal.error": 500,
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;

export function apiError(code: ErrorCode, requestId: string, message?: string) {
  return {
    status: ERROR_CODES[code],
    body: { error: { code, message: message ?? code, request_id: requestId }, api_version: API_VERSION },
  };
}

export function hasScopes(granted: readonly string[], required: readonly Scope[]): boolean {
  return required.every((s) => granted.includes(s));
}

export const PAGE_DEFAULT = 50;
export const PAGE_MAX = 200;

export function parseLimit(raw: string | null): number | null {
  if (raw === null || raw === "") return PAGE_DEFAULT;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= PAGE_MAX ? n : null;
}

/** Cursor opaco: base64url de "v1:<chave>". Chave é o último identificador ordenado. */
export function encodeCursor(key: string): string {
  return btoa(`v1:${key}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeCursor(cursor: string | null): { ok: true; key: string | null } | { ok: false } {
  if (cursor === null || cursor === "") return { ok: true, key: null };
  if (!/^[A-Za-z0-9_-]{1,400}$/.test(cursor)) return { ok: false };
  try {
    const raw = atob(cursor.replace(/-/g, "+").replace(/_/g, "/"));
    if (!raw.startsWith("v1:") || raw.length < 4) return { ok: false };
    return { ok: true, key: raw.slice(3) };
  } catch {
    return { ok: false };
  }
}

/** Página sobre itens já ordenados por `key`; busca limit+1 para saber se há próxima. */
export function pageOf<T>(rows: T[], limit: number, keyOf: (r: T) => string) {
  const items = rows.slice(0, limit);
  const next = rows.length > limit && items.length ? encodeCursor(keyOf(items[items.length - 1]!)) : null;
  return { data: items, next_cursor: next };
}

export function rateLimitDecision(countInWindow: number, limitPerMinute: number) {
  return countInWindow >= limitPerMinute ? { allowed: false as const, retryAfter: 60 } : { allowed: true as const };
}

export const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cabeçalho `X-SIGEM-Signature: t=<unix>,v1=<hmac(t + "." + corpo)>`. */
export async function signWebhook(secret: string, body: string, timestamp: number): Promise<string> {
  return `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${body}`)}`;
}

/** Verificação para o receptor: tolera no máximo `toleranceSec` de diferença (anti-replay). */
export async function verifyWebhook(secret: string, body: string, header: string | null, nowSec: number, toleranceSec = 300): Promise<boolean> {
  if (!header) return false;
  const m = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header);
  if (!m) return false;
  const t = Number(m[1]);
  if (Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = await hmacHex(secret, `${t}.${body}`);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ m[2]!.charCodeAt(i);
  return diff === 0;
}

/** Nunca devolve segredo inteiro. */
export function redactSecret(secret: string | null | undefined): string {
  if (!secret) return "";
  return `…${secret.slice(-4)}`;
}

/** Só os campos declarados no catálogo saem no payload. */
export function minimizePayload(type: EventType, data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of EVENT_CATALOG[type].fields) if (f in data) out[f] = data[f];
  return out;
}

export const MAX_ATTEMPTS = 6;
/** Atraso antes da próxima tentativa; null = dead-letter. */
export function nextAttemptDelaySec(attemptsDone: number): number | null {
  if (attemptsDone >= MAX_ATTEMPTS) return null;
  return [30, 120, 600, 1800, 7200, 21600][attemptsDone - 1] ?? 30;
}

export function isRetryableStatus(status: number | null): boolean {
  return status === null || status === 408 || status === 429 || status >= 500;
}
