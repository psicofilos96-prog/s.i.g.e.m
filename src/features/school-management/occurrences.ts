// Direção L12 — Histórico de Ocorrências ("Caderno Negro"): núcleo puro.
// O banco é imutável (sem edição nem exclusão); retificação é sempre adendo ligado à ocorrência original.
// Gravidade e providências são padrões do sistema (editáveis por nova versão), nunca norma disciplinar homologada.

export const DEFAULT_SEVERITIES = ["Leve", "Média", "Grave", "Gravíssima"] as const;
export const DEFAULT_MEASURES = [
  "Advertência verbal", "Advertência escrita", "Convocação dos responsáveis", "Termo de compromisso",
  "Suspensão temporária", "Comunicação ao Conselho Tutelar", "Comunicação a outro órgão de proteção",
] as const;

export type Party = { kind: "estudante" | "servidor" | "outro"; ref: string | null; label: string; role: "envolvido" | "testemunha" };
export interface OccurrenceRow {
  id: string; number_year: number; number_seq: number; addendum_of: string | null; occurred_at: string;
  severity: string; kind: string; narrative: string; measures: string[]; witnesses: string | null; created_at: string; parties: Party[];
}
export interface OccurrenceThread { original: OccurrenceRow; addenda: OccurrenceRow[] }

export const occurrenceNumber = (r: Pick<OccurrenceRow, "number_seq" | "number_year">) => `${String(r.number_seq).padStart(3, "0")}/${r.number_year}`;

/** Agrupa cada original com seus adendos em ordem cronológica de registro; adendo órfão nunca some (vira linha própria). */
export function threads(rows: OccurrenceRow[]): OccurrenceThread[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = new Map<string, OccurrenceThread>();
  for (const r of rows) if (!r.addendum_of || !byId.has(r.addendum_of)) out.set(r.id, { original: r, addenda: [] });
  for (const r of rows) if (r.addendum_of && byId.has(r.addendum_of)) out.get(r.addendum_of)?.addenda.push(r);
  for (const t of out.values()) t.addenda.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return [...out.values()].sort((a, b) => b.original.created_at.localeCompare(a.original.created_at));
}

export interface Draft { occurredAt: string; severity: string; kind: string; narrative: string; parties: Party[]; addendumOf: string | null }

/** Validação local espelhando o banco: ocorrência original exige envolvido; relato mínimo; data não futura. */
export function draftProblems(d: Draft, now = new Date()): string[] {
  const p: string[] = [];
  const t = Date.parse(d.occurredAt);
  if (!d.occurredAt || Number.isNaN(t)) p.push("Informe data e hora do fato.");
  else if (t > now.getTime() + 5 * 60_000) p.push("A data do fato não pode estar no futuro.");
  if (!d.severity.trim()) p.push("Escolha a gravidade.");
  if (!d.kind.trim()) p.push("Informe o tipo da ocorrência.");
  if (d.narrative.trim().length < 10) p.push("Descreva o fato (mínimo de 10 caracteres).");
  if (!d.addendumOf && !d.parties.some((x) => x.role === "envolvido")) p.push("Vincule ao menos um envolvido.");
  return p;
}

/** Contagem do mês só sobre ocorrências originais lidas; leitura falha = null, nunca zero. */
export function graveInMonth(rows: OccurrenceRow[] | null, month: string, grave: readonly string[] = ["Grave", "Gravíssima"]): number | null {
  if (!rows) return null;
  return rows.filter((r) => !r.addendum_of && r.occurred_at.slice(0, 7) === month && grave.includes(r.severity)).length;
}
