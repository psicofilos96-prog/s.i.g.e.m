// Observabilidade do SIGEM: log estruturado, classificação de erro e métricas técnicas.
// Nunca registra payloads; todo texto passa por redactText e todo objeto por redactFields.
// Sem provedor externo: a saída é console (JSON por linha), capturada pela plataforma.

export type ErrorClass =
  | "expected.auth" // sessão ausente/expirada: resposta normal, não incidente
  | "expected.forbidden" // capability ausente/RLS: resposta normal, não incidente
  | "expected.validation" // entrada inválida ou conflito otimista
  | "incident.dependency" // banco/auth/rede indisponível
  | "incident.internal"; // falha não prevista

export const isIncident = (c: ErrorClass) => c.startsWith("incident.");

const SENSITIVE_KEY =
  /(pass(word)?|senha|token|secret|authorization|cookie|api[-_]?key|cpf|documento|document_number|nota|grade|score|diagn|laudo|saude|health_|email|telefone|phone|endereco|address|nascimento|birth|payload|body)/i;

// Siglas curtas só como chave inteira ou segmento (evita "target" casar com "rg").
const SHORT_SENSITIVE_KEY = /(^|[_-])(rg|nis|cid)($|[_-])/i;

const PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]"],
  [/\bsb_(secret|publishable)_[A-Za-z0-9_-]+/g, "[key]"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/((?:sb-[^=;\s]+|cookie)[=:]\s*)[^;\s]+/gi, "$1[redacted]"],
];

export function redactText(input: unknown, max = 300): string {
  let s = typeof input === "string" ? input : input instanceof Error ? input.message : String(input ?? "");
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function redactFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY.test(k) || SHORT_SENSITIVE_KEY.test(k)) out[k] = "[redacted]";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (typeof v === "string") out[k] = redactText(v, 120);
    else out[k] = "[omitted]"; // objetos/arrays nunca são logados
  }
  return out;
}

export function classifyError(error: unknown): ErrorClass {
  const e = (error ?? {}) as { status?: number; statusCode?: number; code?: string; message?: string };
  const status = e.status ?? e.statusCode;
  const code = String(e.code ?? "");
  const msg = String(e.message ?? error ?? "").toLowerCase();
  if (status === 401 || code === "PGRST301" || /unauthorized|jwt expired|not authenticated/.test(msg)) return "expected.auth";
  if (status === 403 || code === "42501" || /forbidden|permission denied|capability/.test(msg)) return "expected.forbidden";
  if (status === 400 || status === 409 || status === 422 || code.startsWith("22") || code.startsWith("23") || code === "P0001" || /invalid|conflito|conflict|validation/.test(msg))
    return "expected.validation";
  if (status === 502 || status === 503 || status === 504 || code.startsWith("08") || code === "57P01" || /fetch failed|network|timeout|econn|unavailable/.test(msg))
    return "incident.dependency";
  return "incident.internal";
}

export type LogEvent = {
  event: string;
  requestId?: string | undefined;
  level?: "info" | "warn" | "error";
  fields?: Record<string, unknown>;
};

export function formatLog(e: LogEvent, now = new Date()): string {
  return JSON.stringify({
    ts: now.toISOString(),
    level: e.level ?? "info",
    event: e.event,
    requestId: e.requestId,
    ...(e.fields ? redactFields(e.fields) : {}),
  });
}

export function log(e: LogEvent): void {
  const line = formatLog(e);
  if (e.level === "error") console.error(line);
  else if (e.level === "warn") console.warn(line);
  else console.log(line);
}

/** Registra um erro classificado. Esperado → warn sem stack; incidente → error. */
export function logError(event: string, error: unknown, requestId?: string, fields: Record<string, unknown> = {}): ErrorClass {
  const cls = classifyError(error);
  log({
    event,
    requestId,
    level: isIncident(cls) ? "error" : "warn",
    fields: { ...fields, errorClass: cls, message: redactText(error) },
  });
  return cls;
}

/** Métrica técnica: só nome, duração, resultado e rótulos não sensíveis. */
export function metric(name: string, durationMs: number, outcome: "ok" | ErrorClass, labels: Record<string, string | number> = {}, requestId?: string) {
  log({ event: "metric", requestId, level: outcome === "ok" || !isIncident(outcome) ? "info" : "error", fields: { metric: name, durationMs: Math.round(durationMs), outcome, ...labels } });
}

export async function timed<T>(name: string, fn: () => Promise<T>, labels: Record<string, string | number> = {}, requestId?: string): Promise<T> {
  const t0 = Date.now();
  try {
    const r = await fn();
    metric(name, Date.now() - t0, "ok", labels, requestId);
    return r;
  } catch (err) {
    metric(name, Date.now() - t0, classifyError(err), labels, requestId);
    throw err;
  }
}

const RID = /^[A-Za-z0-9-]{8,64}$/;
export function resolveRequestId(header: string | null | undefined): string {
  return header && RID.test(header) ? header : crypto.randomUUID();
}
