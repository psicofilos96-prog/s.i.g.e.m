import { Link } from "@tanstack/react-router";
import { ClipboardCheck, NotebookPen, UsersRound, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/sigem/patterns";
import { diaryContext, DEFAULT_DIARY_PROFESSIONAL_ID, type DiarySearch } from "@/features/diary/diary-data";
import { dailyAgenda, useLocalLessonRecords } from "@/features/diary/lesson-records";
import { DateStepper } from "@/features/diary/diary-journey-view";
import { formatAcademicDate } from "@/lib/academic-date";
import { MyDiariesPage } from "./my-diaries-page";

export function TeacherDayHome({ search }: { search: DiarySearch }) {
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const local = useLocalLessonRecords();
  const agenda = dailyAgenda(context.professionalId, context.referenceDate, local).filter((i) => (!search.turma || i.classId === search.turma) && (!search.componente || i.field === search.componente));
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-3xl font-semibold">Minhas aulas</h1><p className="mt-1 text-muted-foreground">{formatAcademicDate(context.referenceDate)}</p></div><DateStepper date={context.referenceDate} search={search} /></header>
    <section aria-label="Aulas do dia">
      {agenda.length ? <ul className="grid gap-3 lg:grid-cols-2">{agenda.map((a) => <li key={a.key} className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold">{a.className} · {a.field}</h2><p className="text-sm text-muted-foreground">{a.unitName}</p></div><span className="flex shrink-0 items-center gap-1 text-sm"><CalendarDays className="size-4" />{a.block.start}–{a.block.end}</span></div>
        <div className="flex flex-wrap gap-2"><Button asChild><Link to="/diario/chamadas" search={{ ...search, data: a.date, turma: a.classId, componente: a.field }}><ClipboardCheck />Fazer chamada</Link></Button>
          <Button asChild variant="outline"><Link to="/diario/registrar" search={{ ...search, data: a.date, turma: a.classId, componente: a.field, atuacao: a.assignmentId }}><NotebookPen />Registrar aula</Link></Button>
          <Button asChild variant="ghost"><Link to="/diario/turmas/$turmaId/alunos" params={{ turmaId: a.classId }} search={search}><UsersRound />Ver alunos</Link></Button></div>
      </li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhuma aula confirmada na grade nesta data.</p>}
    </section>
    <MyDiariesPage search={search} compact />
  </div>;
}