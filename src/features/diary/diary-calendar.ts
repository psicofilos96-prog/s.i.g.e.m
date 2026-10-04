/**
 * B4.6.7 Fatia 3 — calendário institucional no Diário: escopo = alocações canônicas (logical_id) da
 * TURMA que tocam o intervalo, lidas da cadeia institucional (`rosterStudents()`), e contexto de sessão
 * aceito pelo controlador (`diaryWriteContext().key` = userId#revisão). Sem contexto ou com roster ainda
 * não pronto ⇒ nenhum escopo: o adaptador devolve estado próprio (nunca zero, nunca laboratório).
 */
import { useSyncExternalStore } from "react";
import { institutionalCalendarDependency } from "@/features/calendar/institutional-calendar-days";
import { subscribeComposedCalendar, composedCalendarVersion } from "@/features/calendar/institutional-calendar-composed";
import { rosterStudents, rosterStatus } from "@/features/students/institutional-roster";
import type { DemonstrationStudent } from "@/features/students/students-data";
import { diaryReference, diaryWriteContext } from "./diary-session-state";

const overlaps = (from: string | null | undefined, until: string | null | undefined, start: string, end: string) =>
  (!from || from <= end) && (!until || until >= start);

/** Alocações (logical_id) da turma que tocam [start, end]; nenhuma é escolhida como principal. */
export function classAllocationIds(students: readonly DemonstrationStudent[], classId: string, start: string, end: string): string[] {
  const out = new Set<string>();
  for (const s of students)
    for (const e of s.enrollments ?? [])
      for (const l of e.academicLinks ?? [])
        for (const p of l.participations ?? [])
          for (const a of p.allocations ?? [])
            if (a.classId === classId && overlaps(a.from, a.until, start, end)) out.add(a.logicalId ?? a.id);
  return [...out].sort();
}

export type DiaryCalendarScope = { contextKey: string; allocations: string[] } | null;

export function diaryCalendarScope(classId: string | null | undefined, range: { start: string; end: string } | null): DiaryCalendarScope {
  const ctx = diaryWriteContext();
  if (!ctx || !classId || !range || rosterStatus() !== "pronta") return null;
  return { contextKey: ctx.key, allocations: classAllocationIds(rosterStudents(), classId, range.start, range.end) };
}

/**
 * Dependência de calendário de uma turma no Diário (UM knownAt do controlador). Sem escopo determinável
 * o resultado é "carregando"/indeterminado, nunca determinado por ausência.
 */
export function diaryClassCalendar(classId: string | null | undefined, range: { start: string; end: string } | null) {
  const ref = diaryReference();
  const scope = diaryCalendarScope(classId, range);
  return institutionalCalendarDependency(range, ref?.knownAt, scope ?? "pendente");
}

/** Re-renderiza quando a leitura do servidor chega. */
export function useComposedCalendarRefresh() {
  return useSyncExternalStore(subscribeComposedCalendar, composedCalendarVersion, () => 0);
}
