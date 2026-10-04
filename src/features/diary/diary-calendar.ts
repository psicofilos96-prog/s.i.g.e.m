/**
 * B4.6.7 Fatia 3 — calendário institucional no Diário: escopo = alocações canônicas (logical_id) da
 * TURMA que tocam o intervalo, lidas da cadeia institucional (`rosterStudents()`), e contexto de sessão
 * aceito pelo controlador (`diaryWriteContext().key` = userId#revisão). Sem contexto ou com roster ainda
 * não pronto ⇒ nenhum escopo: o adaptador devolve estado próprio (nunca zero, nunca laboratório).
 */
import { useSyncExternalStore } from "react";
import { institutionalCalendarDependency } from "@/features/calendar/institutional-calendar-days";
import { subscribeComposedCalendar, composedCalendarVersion, type AllocationWindow } from "@/features/calendar/institutional-calendar-composed";
import { rosterStudents, rosterStatus } from "@/features/students/institutional-roster";
import type { DemonstrationStudent } from "@/features/students/students-data";
import { diaryReference, diaryWriteContext } from "./diary-session-state";

const maxD = (...v: (string | null | undefined)[]) => v.filter((x): x is string => !!x).sort().at(-1) ?? null;
const minD = (...v: (string | null | undefined)[]) => v.filter((x): x is string => !!x).sort()[0] ?? null;

/**
 * Pertença POR DATA das alocações da turma: janela = inscrição ∩ participação ∩ alocação, toda lida da
 * cadeia canônica no mesmo knownAt. Só alocações cuja janela toca [start, end]; nenhuma é principal.
 * Admissão/transferência no meio do período exclui o estudante apenas fora da sua vigência comprovada.
 */
export function classAllocationWindows(students: readonly DemonstrationStudent[], classId: string, start: string, end: string): AllocationWindow[] {
  const out = new Map<string, AllocationWindow>();
  for (const s of students)
    for (const e of s.enrollments ?? [])
      for (const l of e.academicLinks ?? [])
        for (const p of l.participations ?? [])
          for (const a of p.allocations ?? []) {
            if (a.classId !== classId) continue;
            const from = maxD(e.openedAt, p.validFrom, a.from);
            const until = minD(e.closedAt, p.validUntil, a.until);
            if (from && until && from > until) continue; // janela vazia comprovada
            if ((from && from > end) || (until && until < start)) continue;
            const id = a.logicalId ?? a.id;
            out.set(id, { id, from, until });
          }
  return [...out.values()].sort((x, y) => x.id.localeCompare(y.id));
}

/** Compatibilidade: só os IDs. */
export function classAllocationIds(students: readonly DemonstrationStudent[], classId: string, start: string, end: string): string[] {
  return classAllocationWindows(students, classId, start, end).map((w) => w.id);
}

export type DiaryCalendarScope = { contextKey: string; allocations: AllocationWindow[] } | null;

export function diaryCalendarScope(classId: string | null | undefined, range: { start: string; end: string } | null): DiaryCalendarScope {
  const ctx = diaryWriteContext();
  if (!ctx || !classId || !range || rosterStatus() !== "pronta") return null;
  return { contextKey: ctx.key, allocations: classAllocationWindows(rosterStudents(), classId, range.start, range.end) };
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
