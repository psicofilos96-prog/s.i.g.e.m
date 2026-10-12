import { operationalToday, operationalClock } from "@/lib/academic-date";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck2, ClipboardList, NotebookPen, BookOpen, LineChart, ListTodo } from "lucide-react";
import { teachingClassBlocks } from "./institutional-teaching";
import { weekdayOf } from "./lesson-records";
import { agendaConflicts, blocksForDate } from "./teacher-agenda";
import { lessonFocus, validStudents, PREVISTA_NOTE, type CentralBlock } from "./lesson-central";
import { rosterStudents } from "@/features/students/institutional-roster";
import { StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type A = { classId: string; className: string; field: string | null; unitName?: string; componentId?: string | null };

/** Lote 03 — Central da Aula: aula agora/próxima vinda só da grade publicada, com ações contextuais. */
export function NextLessonCard({ assignments, date }: { assignments: readonly A[]; date: string }) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date();
    setNow(`${operationalToday(d)}T${operationalClock(d).hhmm}`);
  }, []);
  if (!assignments.length) return null;
  const seen = new Set<string>();
  const unique = assignments.filter((a) => !seen.has(a.classId + a.field) && seen.add(a.classId + a.field));
  const blocks: CentralBlock[] = unique.flatMap((a) =>
    blocksForDate(date, weekdayOf(date), [{ classLabel: a.className, componentLabel: a.field, blocks: teachingClassBlocks(a.classId, date) }])
      .map((b) => ({ ...b, classId: a.classId, component: a.field })));
  if (!blocks.length)
    return <StatePanel tone="info" title="Nenhuma aula prevista nesta data" description="A grade publicada não tem aulas suas para este dia. Nada é deduzido de carga horária." />;
  const focus = lessonFocus(blocks, now && now.slice(0, 10) === date ? now : `${date}T00:00`);
  const conflicts = agendaConflicts(blocks);
  const block = focus.kind === "agora" || focus.kind === "proxima" ? focus.block : focus.kind === "encerradas" ? focus.last : null;
  const a = block ? unique.find((x) => x.classId === block.classId) : undefined;
  const students = block ? validStudents(rosterStudents(), block.classId) : [];
  const search = block ? { turma: block.classId, data: date } : {};
  return (
    <section aria-labelledby="central-title" className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="central-title" className="text-xs uppercase tracking-wide text-muted-foreground">Central da Aula</h2>
        <Badge variant={focus.kind === "agora" ? "default" : "outline"}>
          {focus.kind === "agora" ? "Em andamento" : focus.kind === "proxima" ? "Próxima" : "Aulas do dia encerradas"}
        </Badge>
      </div>
      {block ? (
        <>
          <p className="break-words text-lg font-semibold text-foreground">
            {block.start}–{block.end} · {block.classLabel}{block.componentLabel ? ` · ${block.componentLabel}` : ""}
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Escola</dt><dd className="break-words">{a?.unitName ?? "Não informada"}</dd></div>
            <div><dt className="text-muted-foreground">Data</dt><dd>{date}</dd></div>
            <div><dt className="text-muted-foreground">Alunos válidos</dt><dd>{students.length ? students.length : "Nenhum na lista lida"}</dd></div>
            <div><dt className="text-muted-foreground">Situação</dt><dd>Prevista</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">{PREVISTA_NOTE}</p>
          <nav aria-label="Ações da aula" className="flex flex-wrap gap-2">
            <Button asChild size="sm"><Link to="/diario/chamadas" search={search}><CalendarCheck2 /> Fazer chamada</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/diario/registrar" search={search}><NotebookPen /> Registrar aula</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/diario/turmas/$turmaId/avaliacao" params={{ turmaId: block.classId }} search={search}><ClipboardList /> Lançar resultados</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/diario/turmas/$turmaId/alunos" params={{ turmaId: block.classId }} search={search}><LineChart /> Ver aprendizagem</Link></Button>
            <Button asChild size="sm" variant="ghost"><Link to="/planejamento"><BookOpen /> Plano</Link></Button>
            <Button asChild size="sm" variant="ghost"><a href="#pending-title"><ListTodo /> Pendências</a></Button>
          </nav>
        </>
      ) : null}
      {conflicts.length ? (
        <p className="text-sm text-destructive">
          {conflicts.length} sobreposição(ões) de horário na grade publicada: {conflicts.map(([x, y]) => `${x.classLabel} ${x.start} × ${y.classLabel} ${y.start}`).join("; ")}.
        </p>
      ) : null}
    </section>
  );
}
