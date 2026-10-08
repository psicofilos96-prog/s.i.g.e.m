import { operationalToday, operationalClock } from "@/lib/academic-date";
import { useEffect, useState } from "react";
import { teachingClassBlocks } from "./institutional-teaching";
import { weekdayOf } from "./lesson-records";
import { agendaConflicts, blocksForDate, nextLesson } from "./teacher-agenda";
import { StatePanel } from "@/components/sigem/patterns";

type A = { classId: string; className: string; field: string | null };

/** N10.2.2 — próxima aula vinda só da grade publicada; conflito = sobreposição factual. */
export function NextLessonCard({ assignments, date }: { assignments: readonly A[]; date: string }) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date();
    setNow(`${operationalToday(d)}T${operationalClock(d).hhmm}`);
  }, []);
  const seen = new Set<string>();
  const items = assignments.filter((a) => !seen.has(a.classId + a.field) && seen.add(a.classId + a.field)).map((a) => ({
    classLabel: a.className, componentLabel: a.field, blocks: teachingClassBlocks(a.classId, date),
  }));
  const blocks = blocksForDate(date, weekdayOf(date), items);
  if (!assignments.length) return null;
  if (!blocks.length)
    return <StatePanel tone="info" title="Nenhuma aula prevista nesta data" description="A grade publicada não tem aulas suas para este dia. Nada é deduzido de carga horária." />;
  const next = now ? nextLesson(blocks, now.slice(0, 10) === date ? now : `${date}T00:00`) : null;
  const conflicts = agendaConflicts(blocks);
  return (
    <section aria-label="Próxima aula" className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Próxima aula</p>
      {next ? (
        <p className="mt-1 break-words text-lg font-semibold text-foreground">
          {next.start}–{next.end} · {next.classLabel}{next.componentLabel ? ` · ${next.componentLabel}` : ""}
        </p>
      ) : <p className="mt-1 text-sm text-muted-foreground">As aulas previstas para hoje já terminaram.</p>}
      {conflicts.length ? (
        <p className="mt-2 text-sm text-destructive">
          {conflicts.length} sobreposição(ões) de horário na grade publicada: {conflicts.map(([a, b]) => `${a.classLabel} ${a.start} × ${b.classLabel} ${b.start}`).join("; ")}.
        </p>
      ) : null}
    </section>
  );
}
