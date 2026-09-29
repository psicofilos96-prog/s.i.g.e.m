/**
 * 14.5 — Leitura temporal da fonte institucional de matrícula, enturmação e
 * movimentação. Estudante ≠ matrícula ≠ enturmação ≠ movimentação.
 *
 * Funções puras sobre as linhas do banco. Nada é inferido: término não vira
 * transferência, ausência de data continua ausência, e a turma atual nunca
 * reconstrói a turma histórica.
 */

export type EnrollmentRow = {
  id: string;
  student_id: string;
  school_id: string;
  cycle_id: string | null;
  opened_on: string | null;
  institutional_number: string | null;
  originating_act_ref: string | null;
  supersedes_id: string | null;
  correction_reason: string | null;
  recorded_by: string | null;
  created_at: string;
};
export type EnrollmentEndingRow = { enrollment_id: string; ended_on: string; bond_status_id: string; reason_text: string | null; originating_act_ref: string | null };
export type EpisodeRow = {
  id: string;
  enrollment_id: string;
  student_id: string;
  school_id: string;
  class_id: string;
  class_label_snapshot: string;
  cycle_id: string | null;
  valid_from: string;
  originating_act_ref: string | null;
  supersedes_id: string | null;
  correction_reason: string | null;
  created_at: string;
};
export type EpisodeEndingRow = { episode_id: string; ended_on: string; reason_label: string | null; originating_act_ref: string | null };
export type MovementPole = { schoolId?: string; classId?: string; externalLabel?: string } | null;
export type MovementRow = {
  id: string;
  logical_id: string;
  version: number;
  supersedes_id: string | null;
  student_id: string;
  enrollment_id: string | null;
  movement_type_id: string;
  movement_type_version: number;
  effective_on: string | null;
  origin: MovementPole;
  destination: MovementPole;
  reason_code: string | null;
  reason_text: string | null;
  originating_act_ref: string | null;
  correction_reason: string | null;
  recorded_by: string;
  created_at: string;
};

/** Versões vigentes = não substituídas. A substituída permanece na história. */
export function currentVersions<T extends { id: string; supersedes_id: string | null }>(rows: readonly T[]): T[] {
  const superseded = new Set(rows.map((r) => r.supersedes_id).filter((x): x is string => !!x));
  return rows.filter((r) => !superseded.has(r.id));
}

/** Cadeia completa de uma versão, da mais antiga à vigente. */
export function versionChain<T extends { id: string; supersedes_id: string | null }>(rows: readonly T[], anyId: string): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const next = new Map(rows.filter((r) => r.supersedes_id).map((r) => [r.supersedes_id!, r]));
  let head = byId.get(anyId);
  while (head?.supersedes_id && byId.has(head.supersedes_id)) head = byId.get(head.supersedes_id);
  const out: T[] = [];
  while (head) { out.push(head); head = next.get(head.id); }
  return out;
}

/** Vigência [from, to] inclusiva; `from` ausente ⇒ indeterminado, nunca "sempre". */
export type ValidityAnswer = "vigente" | "fora-da-vigencia" | "indeterminado";
export function validOn(from: string | null, to: string | null, date: string): ValidityAnswer {
  if (!from) return "indeterminado";
  if (date < from) return "fora-da-vigencia";
  if (to && date > to) return "fora-da-vigencia";
  return "vigente";
}

export type EpisodeView = EpisodeRow & { ended_on: string | null; ending_reason: string | null };

export function episodeViews(episodes: readonly EpisodeRow[], endings: readonly EpisodeEndingRow[]): EpisodeView[] {
  const end = new Map(endings.map((e) => [e.episode_id, e]));
  return currentVersions(episodes).map((e) => ({ ...e, ended_on: end.get(e.id)?.ended_on ?? null, ending_reason: end.get(e.id)?.reason_label ?? null }));
}

/** "Quem pertencia à turma na data?" — só episódios vigentes naquela data. */
export function classMembersOn(classId: string, date: string, episodes: readonly EpisodeView[]): EpisodeView[] {
  return episodes.filter((e) => e.class_id === classId && validOn(e.valid_from, e.ended_on, date) === "vigente");
}

/** "Onde o estudante estava na data?" — pode haver mais de um episódio (ex.: AEE). */
export function studentPlacementOn(studentId: string, date: string, episodes: readonly EpisodeView[]): EpisodeView[] {
  return episodes.filter((e) => e.student_id === studentId && validOn(e.valid_from, e.ended_on, date) === "vigente");
}

/** "Estava enturmado quando o fato foi produzido?" — a resposta é do episódio, não do estado atual. */
export function wasMemberAt(studentId: string, classId: string, date: string, episodes: readonly EpisodeView[]): ValidityAnswer {
  const mine = episodes.filter((e) => e.student_id === studentId && e.class_id === classId);
  if (mine.length === 0) return "fora-da-vigencia";
  const answers = mine.map((e) => validOn(e.valid_from, e.ended_on, date));
  if (answers.includes("vigente")) return "vigente";
  if (answers.includes("indeterminado")) return "indeterminado";
  return "fora-da-vigencia";
}

/** Movimentações vigentes do estudante, ordenadas por data de efeito (sem data ⇒ ao final, nunca inventada). */
export function studentMovements(studentId: string, movements: readonly MovementRow[]): MovementRow[] {
  return currentVersions(movements)
    .filter((m) => m.student_id === studentId)
    .sort((a, b) => (a.effective_on ?? "\uffff").localeCompare(b.effective_on ?? "\uffff"));
}

/** Relação temporal entre movimentação e um marco (ex.: fechamento); sem data ⇒ indeterminado. */
export function movementRelativeTo(m: MovementRow, milestone: string): "antes" | "no-dia" | "depois" | "indeterminado" {
  if (!m.effective_on) return "indeterminado";
  return m.effective_on < milestone ? "antes" : m.effective_on === milestone ? "no-dia" : "depois";
}
