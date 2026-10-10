/**
 * LOTE 4/14 — Jornada DECLARADA do estudante 2026 (fonte EducaCenso/planilha de jornadas),
 * já normalizada em `student_school_day_intervals`. Não é grade oficial da turma
 * nem carga horária docente. Leitura só com a sessão (RLS segue a observação de origem); nada gravado.
 * Só observações conhecidas em 2026 entram: 2027 não é tocado nem exibido aqui.
 */
import { supabase } from "@/integrations/supabase/client";

export const JOURNEY_YEAR = 2026;
export const WEEKDAY_LABEL: Readonly<Record<number, string>> = { 0: "Domingo", 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado", 7: "Domingo" };

export type IntervalRow = { id: string; weekday: number; starts_at: string; ends_at: string; parser: string; observation_id: string;
  obs: { student_id: string; class_id: string | null; schedule_literal: string | null; known_at: string; source_ref: string | null } };
export type DayInterval = Readonly<{ id: string; weekday: number; weekdayLabel: string; start: string; end: string;
  studentId: string; classId: string | null; literal: string | null; parser: string; source: string | null; knownAt: string }>;

export function inYear(knownAt: string, year = JOURNEY_YEAR): boolean { return knownAt.slice(0, 4) === String(year); }
const hhmm = (t: string) => t.slice(0, 5);

export function projectIntervals(rows: readonly IntervalRow[]): DayInterval[] {
  return rows.filter((r) => inYear(r.obs.known_at)).map((r) => ({
    id: r.id, weekday: r.weekday, weekdayLabel: WEEKDAY_LABEL[r.weekday] ?? "Dia não reconhecido",
    start: hhmm(r.starts_at), end: hhmm(r.ends_at), studentId: r.obs.student_id, classId: r.obs.class_id,
    literal: r.obs.schedule_literal, parser: r.parser, source: r.obs.source_ref, knownAt: r.obs.known_at,
  })).sort((a, b) => (a.weekday || 7) - (b.weekday || 7) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

const SELECT = "id, weekday, starts_at, ends_at, parser, observation_id, obs:student_school_day_observations!inner(student_id, class_id, schedule_literal, known_at, source_ref)";

export async function readDayIntervals(by: { studentId: string } | { classId: string }, signal?: AbortSignal): Promise<DayInterval[]> {
  let b = supabase.from("student_school_day_intervals").select(SELECT)
    .gte("obs.known_at", `${JOURNEY_YEAR}-01-01`).lt("obs.known_at", `${JOURNEY_YEAR + 1}-01-01`);
  b = "studentId" in by ? b.eq("obs.student_id", by.studentId) : b.eq("obs.class_id", by.classId);
  if (signal) b = b.abortSignal(signal);
  const { data, error } = await b.limit(1000);
  if (error) throw new Error(error.message);
  return projectIntervals((data ?? []) as unknown as IntervalRow[]);
}

/** Agrupa por aluno (turma) mantendo ordem de dia/horário. */
export function groupByStudent(list: readonly DayInterval[]): Map<string, DayInterval[]> {
  const m = new Map<string, DayInterval[]>();
  for (const i of list) m.set(i.studentId, [...(m.get(i.studentId) ?? []), i]);
  return m;
}
