/**
 * Frente W — porta TS do Diário do Professor 2027. Lê só `my_diaries_at`/`my_diary_slots_at`/`my_diary_lessons`/`diary_roster_at` e, para gestão, `diary_school_overview_at`
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

/** Aula prevista = bloco da grade do elemento no dia (expectativa, nunca fato registrado). */
export type SlotRow = { block_id: string; block_key: string; starts_at: string; ends_at: string; block_state: string };
export const readSlots = (d: Pick<MyDiary, "assignment_id" | "substitution_id">, on: string) =>
  call<SlotRow[]>("my_diary_slots_at", { _assignment: d.assignment_id, _substitution: d.substitution_id, _on: on });

/** Aula ministrada = cabeça da cadeia + chamada vigente; referências guardadas por ID do item + edição (nunca texto copiado). */
export type LessonRow = { lesson_version_id: string; logical_record_id: string; version_number: number; lesson_date: string;
  facts: { content?: string; observation?: string }; schedule_block_ids: string[]; period_id: string | null; recorded_as: "titular" | "substituto";
  attendance_version_id: string | null; attendance_version_number: number | null; marks: Record<string, Record<string, Mark>> | null;
  eligible_student_ids: string[] | null; reference_item_ids: string[]; reference_edition_ids: string[] };
export const readLessons = (d: Pick<MyDiary, "assignment_id" | "substitution_id">) =>
  call<LessonRow[]>("my_diary_lessons", { _assignment: d.assignment_id, _substitution: d.substitution_id });

export const recordLesson = (a: { logical: string; diary: MyDiary; date: string; base: string | null; content: string; observation: string;
  blocks: string[]; references: string[]; justification: string | null; changed: string[] }) =>
  call<string>("record_lesson_version_v2", { _logical: a.logical, _assignment: a.diary.assignment_id, _substitution: a.diary.substitution_id,
    _date: a.date, _base_version_id: a.base, _facts: { content: a.content, observation: a.observation }, _blocks: a.blocks, _references: a.references,
    _justification: a.justification, _changed_aspects: a.changed, _plan_id: `aula:${a.logical}:${a.base ?? "origem"}` });

/** Aspectos realmente alterados — correção orientada pela diferença. */
export function changedAspects(l: LessonRow, next: { content: string; observation: string; blocks: string[]; references: string[] }): string[] {
  const same = (x: readonly string[], y: readonly string[]) => [...x].sort().join() === [...y].sort().join();
  return [
    (l.facts.content ?? "") !== next.content && "conteudo",
    (l.facts.observation ?? "") !== next.observation && "observacao",
    !same(l.schedule_block_ids, next.blocks) && "horarios",
    !same(l.reference_item_ids, next.references) && "referencias",
  ].filter((x): x is string => !!x);
}

export type OverviewRow = { result_kind: "lesson" | "access-denied" | "invalid"; class_id: string | null; component_id: string | null;
  assignment_id: string | null; lesson_date: string | null; logical_record_id: string | null; lesson_version: number | null;
  recorded_as: string | null; attendance_version: number | null; marked_count: number | null; eligible_count: number | null };
export const readSchoolOverview = (school: string, from: string, to: string) =>
  call<OverviewRow[]>("diary_school_overview_at", { _school: school, _from: from, _to: to });

/** Marcações só do catálogo existente; aluno sem marcação continua sem marcação (nunca falta). */
export const ATTENDANCE_MARKS = ["Presente", "Ausente"] as const;
export type Mark = (typeof ATTENDANCE_MARKS)[number];
export const recordAttendance = (lessonLogical: string, base: string | null, marks: Record<string, Mark>, justification: string | null) =>
  call<string>("record_attendance_version_v2", { _lesson_logical: lessonLogical, _base_version_id: base, _marks: { aula: marks },
    _justification: justification, _plan_id: `chamada:${lessonLogical}:${base ?? "origem"}` });
/** Marcações vigentes da chamada (fatia "aula"); sem chamada ⇒ vazio, nunca falta. */
export const currentMarks = (l: LessonRow): Record<string, Mark> => ({ ...(l.marks?.["aula"] ?? {}) });

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
  "diary:plan-conflict": "Este registro já foi enviado por outra pessoa; nada foi gravado.",
  "diary:scope-mismatch": "A correção não corresponde à aula original.",
  "diary:slot-not-in-lesson": "O horário não pertence a esta aula.",
  "diary:lesson-legacy-contract": "Aula registrada no fluxo antigo: somente leitura.",
};
export function diaryMessage(raw: string): string {
  const k = Object.keys(MSG).sort((a, b) => b.length - a.length).find((c) => raw.includes(c));
  return k ? MSG[k]! : "Não foi possível registrar; nada foi gravado.";
}
