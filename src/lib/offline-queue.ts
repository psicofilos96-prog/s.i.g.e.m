/**
 * Lote 11 (Expansão) — fila local para uso móvel: núcleo puro, SEM armazenamento e SEM service worker.
 * Decisão vigente do projeto: PWA só manifest, sem cache offline (dados privados). Este núcleo
 * define as regras para quando/se houver decisão de persistir localmente; hoje vive só na memória da sessão.
 */

export type QueuedAction = Readonly<{
  idempotencyKey: string; kind: string; entityId: string; expectedVersion: number | null;
  payload: Readonly<Record<string, unknown>>; createdAt: string; official: boolean;
}>;

/** Atos oficiais (aprovar, homologar, oficializar, fechar) nunca entram na fila offline. */
const OFFICIAL = /aprov|homolog|oficializ|fech|conclu|assin/i;
export function enqueue(queue: readonly QueuedAction[], a: QueuedAction, online: boolean) {
  if (!online && (a.official || OFFICIAL.test(a.kind))) return { ok: false as const, reason: "ato-oficial-exige-conexao", queue };
  if (queue.some((q) => q.idempotencyKey === a.idempotencyKey)) return { ok: true as const, duplicate: true, queue };
  return { ok: true as const, duplicate: false, queue: [...queue, a] };
}

/** Sincronização: o servidor é a verdade. Versão divergente ⇒ conflito explícito para a pessoa resolver. */
export type ServerOutcome = { status: "aplicado" } | { status: "ja-aplicado" } | { status: "conflito"; serverVersion: number } | { status: "negado" } | { status: "rede" };
export function reconcile(queue: readonly QueuedAction[], outcomes: ReadonlyMap<string, ServerOutcome>) {
  const remaining: QueuedAction[] = []; const conflicts: { action: QueuedAction; serverVersion: number }[] = []; const denied: QueuedAction[] = [];
  for (const a of queue) {
    const o = outcomes.get(a.idempotencyKey);
    if (!o || o.status === "rede") remaining.push(a);
    else if (o.status === "conflito") conflicts.push({ action: a, serverVersion: o.serverVersion });
    else if (o.status === "negado") denied.push(a);
  }
  return { remaining, conflicts, denied };
}

/** Retenção: item mais antigo que o limite configurado é descartado e reportado (nunca enviado tarde em silêncio). */
export function applyRetention(queue: readonly QueuedAction[], now: string, maxHours: number | null) {
  if (maxHours == null) return { kept: [...queue], expired: [] as QueuedAction[] };
  const limit = Date.parse(now) - maxHours * 3_600_000;
  return { kept: queue.filter((a) => Date.parse(a.createdAt) >= limit), expired: queue.filter((a) => Date.parse(a.createdAt) < limit) };
}

/** Perda de sessão ou logout: fila e cache apagados; pendências são informadas, nunca enviadas por outra conta. */
export function onSessionEnd(queue: readonly QueuedAction[]) {
  return { queue: [] as QueuedAction[], discardedCount: queue.length };
}

/** Minimização: só chaves declaradas do payload vão para a fila (nunca nome, CPF, saúde). */
export function minimize(payload: Readonly<Record<string, unknown>>, allowed: readonly string[]) {
  return Object.fromEntries(allowed.filter((k) => k in payload).map((k) => [k, payload[k]]));
}
