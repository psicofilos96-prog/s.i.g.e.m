import { lessonDaySummary } from "./lesson-day-summary";
import type { LessonRow, SlotRow } from "./diary-w-source";

export function LessonDaySummaryPanel({ on, lessons, slots }: { on: string; lessons: readonly LessonRow[] | null; slots: readonly SlotRow[] | null }) {
  let summary;
  try { summary = lessonDaySummary(on, lessons, slots); }
  catch { return <p role="alert" className="text-sm text-destructive">Não foi possível conferir o resumo das aulas: há registros conflitantes.</p>; }
  const counts: readonly [string, number | null][] = [
    ["Aulas registradas", summary.recordedLessons],
    ["Horários previstos", summary.plannedBlocks],
    ["Horários com aula vinculada", summary.recordedPlannedBlocks],
  ];
  return <div className="space-y-2" aria-label="Resumo das aulas do dia">
    <h2 className="font-semibold">Resumo de {on}</h2>
    <dl className="grid gap-3 border-y py-3 sm:grid-cols-3">
      {counts.map(([label, count]) => <div key={label} className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-lg font-semibold tabular-nums">{count === null ? "Não disponível" : count}</dd></div>)}
    </dl>
    {summary.unlinkedLessons !== null && summary.unlinkedLessons > 0 && <p className="text-sm text-muted-foreground">Aulas registradas sem horário vinculado: {summary.unlinkedLessons}</p>}
  </div>;
}
