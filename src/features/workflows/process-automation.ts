/**
 * Lote 02 (Expansão) — primitivas puras da Central de Processos sobre o motor existente.
 * Nada aqui grava, nada conhece fluxo, cargo ou setor real: prazo útil só com dias letivos/úteis
 * vindos de calendário lido; escalonamento só se declarado; anti-loop e escopo falham fechado.
 */

/** Soma N dias úteis a partir de `start` usando só datas úteis fornecidas. Sem calendário ⇒ null (nunca presume). */
export function addBusinessDays(start: string, n: number, businessDays: readonly string[] | null): string | null {
  if (businessDays == null || n < 0 || !Number.isInteger(n)) return null;
  const after = [...new Set(businessDays)].filter((d) => d > start).sort();
  if (n === 0) return start;
  return after[n - 1] ?? null; // calendário não cobre o prazo ⇒ null
}

export type EscalationRule = Readonly<{ afterBusinessDays: number; toQueue: string }>;
/** Escalonamento só existe se declarado; sem regra ou sem calendário ⇒ nenhum. */
export function escalationDue(openedOn: string, today: string, rules: readonly EscalationRule[], businessDays: readonly string[] | null) {
  if (businessDays == null) return { state: "nao-verificavel" as const, queues: [] as string[] };
  const queues = rules.filter((r) => { const d = addBusinessDays(openedOn, r.afterBusinessDays, businessDays); return d != null && d <= today; })
    .map((r) => r.toQueue);
  return { state: "verificado" as const, queues };
}

/** Anti-loop: evento derivado não reemite se a cadeia já passou pela mesma origem ou excedeu profundidade. */
export function allowEmit(chain: readonly string[], next: string, maxDepth = 5): boolean {
  return chain.length < maxDepth && !chain.includes(next);
}

/** Idempotência do outbox: mesma chave entrega uma vez. */
export function dedupeOutbox<T extends { idempotencyKey: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>(); return items.filter((i) => !seen.has(i.idempotencyKey) && (seen.add(i.idempotencyKey), true));
}

/** Retentativa só em falha transitória, com teto; esgotada = dead-letter. */
export function retryDecision(status: number | "rede", attempt: number, maxAttempts = 5): "retry" | "dead-letter" | "final" {
  const transient = status === "rede" || status === 408 || status === 429 || (typeof status === "number" && status >= 500);
  if (!transient) return "final";
  return attempt + 1 >= maxAttempts ? "dead-letter" : "retry";
}

/** Setor só é acionado se a fila tem escopo sobre a escola do processo. */
export function queueInScope(queueSchools: readonly string[] | "rede", schoolId: string | null): boolean {
  if (queueSchools === "rede") return true;
  return schoolId != null && queueSchools.includes(schoolId);
}

export type SlaItem = Readonly<{ dueOn: string | null; closedOn: string | null }>;
/** Indicadores: sem prazo declarado não entra no denominador. */
export function slaIndicators(items: readonly SlaItem[], today: string) {
  const withDue = items.filter((i) => i.dueOn != null);
  const closed = withDue.filter((i) => i.closedOn != null);
  const onTime = closed.filter((i) => i.closedOn! <= i.dueOn!).length;
  const overdueOpen = withDue.filter((i) => i.closedOn == null && i.dueOn! < today).length;
  return { semPrazo: items.length - withDue.length, comPrazo: withDue.length, noPrazo: onTime,
    foraDoPrazo: closed.length - onTime, abertosAtrasados: overdueOpen,
    taxaNoPrazo: closed.length === 0 ? null : Math.round((onTime / closed.length) * 1000) / 10 };
}
