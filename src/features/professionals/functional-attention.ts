/**
 * N11.2-1 — DP "O que precisa de atenção?" e linha do tempo funcional (projeções puras).
 * Só prazos DECLARADOS no fato (validUntil/dueOn) geram alerta; nada é calculado (probatório,
 * quinquênio, aposentadoria) sem regra homologada — esses aparecem como "aguardando regra institucional".
 */
export type FunctionalFact = Readonly<{ id: string; personId: string; kind: string; label: string; occurredOn: string; validUntil?: string | null; dueOn?: string | null; closed?: boolean }>;
export type AttentionItem = Readonly<{ factId: string; personId: string; label: string; date: string; state: "vencido" | "vence-em-breve" }>;

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

export function attentionItems(facts: readonly FunctionalFact[], today: string, windowDays: number): AttentionItem[] {
  const limit = addDays(today, windowDays);
  return facts.flatMap((f) => {
    if (f.closed) return [];
    const date = f.dueOn ?? f.validUntil ?? null; if (!date) return [];
    if (date < today) return [{ factId: f.id, personId: f.personId, label: f.label, date, state: "vencido" as const }];
    if (date <= limit) return [{ factId: f.id, personId: f.personId, label: f.label, date, state: "vence-em-breve" as const }];
    return [];
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function functionalTimeline(facts: readonly FunctionalFact[], personId: string) {
  return facts.filter((f) => f.personId === personId).slice().sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || a.id.localeCompare(b.id));
}

export const RULE_PENDING_ALERTS = ["estagio-probatorio", "quinquenio", "aposentadoria-proxima", "acumulo-de-cargos"] as const;
