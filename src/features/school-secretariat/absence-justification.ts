/** Atestados e justificativas de faltas (Secretaria). Projeção pura dos eventos; não altera a chamada do Diário. */
export type JustificationKind = "atestado-medico" | "atestado-odontologico" | "declaracao-comparecimento" | "outro-amparo-legal";

export const JUSTIFICATION_KINDS: { key: JustificationKind; label: string }[] = [
  { key: "atestado-medico", label: "Atestado médico" },
  { key: "atestado-odontologico", label: "Atestado odontológico" },
  { key: "declaracao-comparecimento", label: "Declaração de comparecimento" },
  { key: "outro-amparo-legal", label: "Outro amparo legal" },
];
export const kindLabel = (k: string | null) => JUSTIFICATION_KINDS.find((x) => x.key === k)?.label ?? "Documento";

export type JustificationEvent = {
  justification_id: string; act: "registrar" | "anular"; doc_kind: string | null;
  starts_on: string | null; ends_on: string | null; issuer_name: string | null; issuer_registry: string | null;
  delivered_by: string | null; delivered_on: string | null; reason: string | null; recorded_at: string;
};
export type Justification = {
  id: string; kind: string; startsOn: string; endsOn: string; days: number; issuer: string; registry: string | null;
  deliveredBy: string | null; deliveredOn: string; note: string | null; voided: boolean; voidReason: string | null;
};

/** Dias corridos do período, inclusive o primeiro e o último. */
export function periodDays(startsOn: string, endsOn: string): number {
  const a = Date.parse(`${startsOn}T00:00:00Z`), b = Date.parse(`${endsOn}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function projectJustifications(events: JustificationEvent[]): Justification[] {
  const voids = new Map(events.filter((e) => e.act === "anular").map((e) => [e.justification_id, e.reason]));
  return events.filter((e) => e.act === "registrar" && e.starts_on && e.ends_on).map((e) => ({
    id: e.justification_id, kind: e.doc_kind ?? "", startsOn: e.starts_on!, endsOn: e.ends_on!,
    days: periodDays(e.starts_on!, e.ends_on!), issuer: e.issuer_name ?? "", registry: e.issuer_registry,
    deliveredBy: e.delivered_by, deliveredOn: e.delivered_on ?? "", note: e.reason,
    voided: voids.has(e.justification_id), voidReason: voids.get(e.justification_id) ?? null,
  })).sort((x, y) => y.startsOn.localeCompare(x.startsOn));
}

/** Está amparado na data? Só por documento registrado e não anulado. */
export function coveredOn(list: Justification[], day: string): Justification | null {
  return list.find((j) => !j.voided && j.startsOn <= day && day <= j.endsOn) ?? null;
}

export const JUSTIFICATION_MESSAGES: Record<string, string> = {
  "justification:capability-missing": "Sua conta não pode registrar atestados nesta escola.",
  "justification:kind-invalid": "Escolha o tipo de documento.",
  "justification:period-invalid": "Confira as datas: a última não pode ser antes da primeira.",
  "justification:period-too-long": "O período passa de um ano. Confira as datas.",
  "justification:date-invalid": "A data de entrega não pode ser no futuro.",
  "justification:issuer-required": "Informe quem emitiu o documento.",
  "justification:not-a-student": "Este aluno não tem matrícula nesta escola.",
  "justification:duplicate": "Este documento já foi registrado.",
  "justification:reason-required": "Explique o motivo da anulação.",
  "justification:already-void": "Este registro já foi anulado.",
};
