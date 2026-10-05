/**
 * Frente W — porta TS do Diário do Professor 2027. Lê só `my_diaries_at`/`diary_roster_at`/`lesson_record_versions` (RLS)
 * e grava só por `record_lesson_version_v2`/`record_attendance_version_v2`. Grade = esperado; aula = fato registrado.
 */
import { supabase } from "@/integrations/supabase/client";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);
async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type MyDiary = { role: "titular" | "substituto"; assignment_id: string; substitution_id: string | null; class_id: string; school_id: string;
  academic_year_id: string; year_state: string | null; engagement_id: string; matrix_id: string | null; item_key: string | null; component_id: string | null;
  component_label: string | null; effective_from: string; effective_until: string | null; assignment_state: string | null };
export const readMyDiaries = (on: string, knownAt: string) => call<MyDiary[]>("my_diaries_at", { _on: on, _known_at: knownAt });

export type RosterRow = { student_id: string; display_name: string; allocation_valid_from: string; allocation_ended_on: string | null };
export const readRoster = (d: Pick<MyDiary, "assignment_id" | "substitution_id">, on: string) =>
  call<RosterRow[]>("diary_roster_at", { _assignment: d.assignment_id, _substitution: d.substitution_id, _on: on });

export type LessonRow = { id: string; logical_record_id: string; version_number: number; lesson_date: string; facts: { content?: string; observation?: string };
  schedule_block_ids: string[]; period_id: string | null; concluded_at: string; supersedes_version_id: string | null };
export async function readLessons(assignmentId: string): Promise<LessonRow[]> {
  const { data, error } = await (supabase.from as unknown as (t: string) => { select: (c: string) => { eq: (k: string, v: string) => PromiseLike<{ data: unknown; error: { message: string } | null }> } })("lesson_record_versions")
    .select("id,logical_record_id,version_number,lesson_date,facts,schedule_block_ids,period_id,concluded_at,supersedes_version_id").eq("assignment_id", assignmentId);
  if (error) throw new Error(error.message);
  return data as LessonRow[];
}
/** Versão vigente por aula lógica (cadeia); versões substituídas ficam só no histórico. */
export const currentLessons = (rows: readonly LessonRow[]) => rows.filter((r) => !rows.some((s) => s.supersedes_version_id === r.id));

export const recordLesson = (a: { logical: string; diary: MyDiary; date: string; base: string | null; content: string; observation: string;
  blocks: string[]; references: string[]; justification: string | null; changed: string[] }) =>
  call<string>("record_lesson_version_v2", { _logical: a.logical, _assignment: a.diary.assignment_id, _substitution: a.diary.substitution_id,
    _date: a.date, _base_version_id: a.base, _facts: { content: a.content, observation: a.observation }, _blocks: a.blocks, _references: a.references,
    _justification: a.justification, _changed_aspects: a.changed, _plan_id: `aula:${a.logical}:${a.base ?? "origem"}` });

/** Marcações só do catálogo existente; aluno sem marcação continua sem marcação (nunca falta). */
export const ATTENDANCE_MARKS = ["Presente", "Ausente"] as const;
export type Mark = (typeof ATTENDANCE_MARKS)[number];
export const recordAttendance = (lessonLogical: string, base: string | null, marks: Record<string, Mark>, justification: string | null) =>
  call<string>("record_attendance_version_v2", { _lesson_logical: lessonLogical, _base_version_id: base, _marks: { aula: marks },
    _justification: justification, _plan_id: `chamada:${lessonLogical}:${base ?? "origem"}` });

/** "Marcar todos presentes" é ato explícito: devolve marcações reais para conferência, nunca default silencioso. */
export function markAll(roster: readonly RosterRow[], mark: Mark, current: Record<string, Mark>): Record<string, Mark> {
  return Object.fromEntries(roster.map((r) => [r.student_id, current[r.student_id] ?? mark]));
}
export const unmarkedCount = (roster: readonly RosterRow[], marks: Record<string, Mark>) => roster.filter((r) => !marks[r.student_id]).length;

const MSG: Record<string, string> = {
  "diary:session-required": "Entre com sua conta para usar o Diário.",
  "diary:natural-person-required": "Sua conta não está ligada a uma pessoa cadastrada; o Diário é só de docentes.",
  "diary:year-not-operational:em-preparacao": "O ano está em preparação: ainda não é possível registrar aulas como ocorridas.",
  "diary:year-not-operational:encerrado": "O ano está encerrado: novos registros estão bloqueados.",
  "diary:year-not-operational:historico-importado": "Ano histórico: o Diário não registra operações retroativas.",
  "diary:year-not-operational": "O ano letivo não está em operação.",
  "diary:assignment-not-effective": "Não há regência sua vigente nesta data.",
  "diary:assignment-not-found": "Regência não encontrada.",
  "diary:not-assignment-holder": "Esta regência pertence a outro docente.",
  "diary:substitution-not-effective": "Sua substituição não está vigente nesta data.",
  "diary:not-substitute": "Esta substituição pertence a outra pessoa.",
  "diary:capability-missing": "Sua atuação não tem autorização para este registro.",
  "diary:period-missing-or-ambiguous": "Não há um único período letivo para esta data.",
  "diary:calendar-missing": "A escola não tem calendário oficial aplicável nesta data.",
  "diary:calendar-ambiguous": "Mais de um calendário se aplica à escola; nada foi gravado.",
  "diary:calendar-not-homologated": "O calendário desta data não está homologado.",
  "diary:not-a-school-day": "Esta data não é dia letivo no calendário oficial.",
  "diary:block-not-in-schedule": "Um dos horários escolhidos não está na grade desta turma neste dia.",
  "diary:stale-head": "O registro mudou desde que você abriu. Recarregue e confira.",
  "diary:no-change": "Nada foi alterado.",
  "diary:lesson-not-registered": "Registre a aula antes da chamada.",
  "diary:student-not-allocated-on-lesson-date": "Há aluno que não estava na turma na data da aula.",
  "diary:invalid-mark": "Marcação não admitida.",
  "diary:empty-attendance": "Nenhuma marcação para registrar.",
  "diary:period-closed": "O período está fechado para novas chamadas.",
  "diary:mark-removal-not-admissible": "Correção não pode apagar marcação já registrada.",
  "diary:justification-required": "A correção exige justificativa.",
  "diary:correction-policy-missing": "Não há regra homologada de correção; nada foi alterado.",
  "diary:correction-forbidden": "A regra vigente não admite esta correção.",
  "diary:reference-unknown": "Referência curricular desconhecida.",
};
export function diaryMessage(raw: string): string {
  const k = Object.keys(MSG).sort((a, b) => b.length - a.length).find((c) => raw.includes(c));
  return k ? MSG[k]! : "Não foi possível registrar; nada foi gravado.";
}
