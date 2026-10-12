/**
 * SIGEM Desenvolvimento L08 — turmas formativas (projeção pura; banco = 0436).
 * Turma formativa é oferta de UMA versão de curso (`dev_classes`); nunca é `institutional_classes` (turma acadêmica).
 * Estado = último evento do ledger; formador = atuação canônica vigente no início.
 */
export const CLASS_STATES = ["planejada", "inscricoes-abertas", "inscricoes-encerradas", "em-andamento", "concluida", "cancelada"] as const;
export type ClassState = (typeof CLASS_STATES)[number];
export type StatusEvent = Readonly<{ seq: number; status: ClassState; reason: string | null; at: string }>;

const NEXT: Record<ClassState, readonly ClassState[]> = {
  planejada: ["inscricoes-abertas", "cancelada"],
  "inscricoes-abertas": ["inscricoes-encerradas", "cancelada"],
  "inscricoes-encerradas": ["inscricoes-abertas", "em-andamento", "cancelada"],
  "em-andamento": ["concluida", "cancelada"],
  concluida: [],
  cancelada: [],
};

/** Espelha `record_dev_class_status`: seq contínuo; lacuna ou repetição ⇒ ambíguo. */
export function currentState(events: readonly StatusEvent[]): { state: ClassState | null; seq: number; ambiguous: boolean } {
  const s = [...events].sort((a, b) => a.seq - b.seq);
  if (s.length === 0) return { state: null, seq: 0, ambiguous: false };
  const ambiguous = s.some((e, i) => e.seq !== i + 1);
  const last = s[s.length - 1]!;
  return { state: ambiguous ? null : last.status, seq: last.seq, ambiguous };
}

export function allowedTransitions(state: ClassState | null): readonly ClassState[] {
  return state ? NEXT[state] : [];
}

/** Motivo obrigatório para cancelar ou reabrir inscrições. */
export function transitionProblems(from: ClassState | null, to: ClassState, reason: string): string[] {
  if (!from) return ["Turma sem histórico de estado; não é possível mudar."];
  if (!NEXT[from].includes(to)) return [`Não é possível ir de "${from}" para "${to}".`];
  if ((to === "cancelada" || to === "inscricoes-abertas") && from !== "planejada" && reason.trim().length < 10) return ["Informe o motivo (10+ caracteres)."];
  return [];
}

export type ClassDraft = Readonly<{ courseHasCatalog: boolean; seats: number | null; startsOn: string; endsOn: string;
  label: string; location: string; audience: string; trainers: readonly { validFrom: string; validUntil: string | null }[] }>;

export function classDraftProblems(d: ClassDraft): string[] {
  const p: string[] = [];
  if (!d.courseHasCatalog) p.push("A versão do curso não tem catálogo (L07).");
  if (d.seats == null || d.seats <= 0) p.push("Informe o número de vagas.");
  if (!d.startsOn || !d.endsOn || d.endsOn < d.startsOn) p.push("Período inválido.");
  if (d.label.trim().length < 2) p.push("Informe a identificação da turma.");
  if (d.location.trim().length < 3) p.push("Informe o local.");
  if (d.audience.trim().length < 3) p.push("Informe o público.");
  if (d.trainers.length === 0) p.push("Informe ao menos um formador.");
  if (d.trainers.some((t) => t.validFrom > d.startsOn || (t.validUntil != null && t.validUntil < d.startsOn))) p.push("Formador sem atuação vigente no início da turma.");
  return p;
}

/** Vagas livres só com vagas configuradas; sem configuração ⇒ null, nunca zero. */
export function freeSeats(seats: number | null, activeEnrollments: number): number | null {
  return seats == null ? null : Math.max(0, seats - activeEnrollments);
}
