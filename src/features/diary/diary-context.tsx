import { formatAcademicDate } from "@/lib/academic-date";
import { Link } from "@tanstack/react-router";
import {
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  GraduationCap,
  SlidersHorizontal,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { cn } from "@/lib/utils";
import {
  dayLabel,
  diaryContext,
  diarySearch,
  type DiaryContext,
  type DiarySearch,
  type DiaryStudent,
  type TaughtLesson,
  lessonContext,
} from "./diary-data";

export function DiaryHeader({
  title,
  description,
  context,
  children,
}: {
  title: string;
  description: string;
  context: DiaryContext;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-border/70 pb-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase text-primary">
            Diário Inteligente · ambiente demonstrativo
          </p>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:max-w-[min(32rem,42vw)] lg:justify-end">
          <StatusBadge tone={context.historical ? "neutral" : "success"}>
            {context.historical ? "Consulta histórica" : "Contexto atual"}
          </StatusBadge>
          {children}
        </div>
      </div>
      <nav
        aria-label="Navegação do Diário"
        className="mt-4 grid grid-cols-2 gap-1 border-t border-border/50 pt-2 sm:flex sm:flex-wrap"
      >
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-w-0 justify-start sm:justify-center"
        >
          <Link to="/diario">Meu Diário</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-w-0 justify-start sm:justify-center"
        >
          <Link to="/diario/turmas">Minhas turmas</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-w-0 justify-start sm:justify-center"
        >
          <Link to="/diario/registrar">Registrar aula</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-w-0 justify-start sm:justify-center"
        >
          <Link to="/diario/aulas">Histórico de aulas</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-w-0 justify-start sm:justify-center"
        >
          <Link to="/diario/chamadas">Chamadas</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-w-0 justify-start sm:justify-center"
        >
          <Link to="/diario/frequencia">Frequência</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-w-0 justify-start sm:justify-center"
        >
          <Link to="/diario/documentos">Documentos</Link>
        </Button>
      </nav>
    </header>
  );
}

export function AcademicContextSelector({
  context,
  search,
  onChange,
  compact: _compact = false,
  hideDate = false,
}: {
  context: DiaryContext;
  search: DiarySearch;
  onChange: (value: DiarySearch) => void;
  compact?: boolean;
  hideDate?: boolean;
}) {
  const mobile = useIsMobile();
  const selected = context.assignments.find(
    (item) =>
      item.classId === search.turma &&
      (!search.unidade || item.unitId === search.unidade) &&
      (!search.componente || item.field === search.componente),
  );
  const choose = (assignment?: DiaryContext["assignments"][number]) =>
    onChange(
      assignment
        ? diarySearch(search, {
            unidade: assignment.unitId,
            turma: assignment.classId,
            componente: assignment.field,
            periodo: assignment.periodLabel,
          })
        : Object.fromEntries(
            Object.entries(search).filter(
              ([key]) => !["unidade", "turma", "componente", "periodo"].includes(key),
            ),
          ),
    );
  const choices = (
    <div className="grid gap-2" role="radiogroup" aria-label="Atuação pedagógica vigente">
      <Button
        type="button"
        variant={!selected ? "secondary" : "ghost"}
        className="min-h-11 justify-start text-left"
        role="radio"
        aria-checked={!selected}
        onClick={() => choose()}
      >
        Todas as atuações vigentes
      </Button>
      {context.assignments.map((item) => (
        <Button
          key={item.record.id}
          type="button"
          variant={selected?.record.id === item.record.id ? "secondary" : "ghost"}
          className="h-auto min-h-11 justify-start px-3 py-2 text-left"
          role="radio"
          aria-checked={selected?.record.id === item.record.id}
          onClick={() => choose(item)}
        >
          <span className="min-w-0">
            <span className="block break-words text-sm">
              {item.className} · {item.field}
            </span>
            <span className="block break-words text-xs font-normal text-muted-foreground">
              {item.unitName} · {item.record.role} · vínculo {item.record.linkId}
            </span>
          </span>
        </Button>
      ))}
    </div>
  );
  const trigger = (
    <Button
      type="button"
      variant="outline"
      className="h-auto min-h-11 max-w-full justify-start px-3 py-2 text-left"
    >
      <SlidersHorizontal />
      <span className="min-w-0">
        <span className="block text-xs font-normal text-muted-foreground">Contexto docente</span>
        <span className="block break-words">
          {selected ? `${selected.className} · ${selected.field}` : "Todas as atuações"}
        </span>
      </span>
    </Button>
  );
  return (
    <section
      aria-label="Contexto acadêmico"
      className={cn(
        "border-y border-border/70 bg-card/75 px-3 py-3 shadow-panel sm:rounded-md sm:border",
        context.historical && "border-dashed",
      )}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          {mobile ? (
            <Sheet>
              <SheetTrigger asChild>{trigger}</SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
                <SheetHeader className="text-left">
                  <SheetTitle>Trocar contexto docente</SheetTitle>
                  <SheetDescription>
                    Escolha uma atuação vigente; escola, turma e campo são atualizados juntos.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4">{choices}</div>
              </SheetContent>
            </Sheet>
          ) : (
            <Popover>
              <PopoverTrigger asChild>{trigger}</PopoverTrigger>
              <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))]">
                <p className="mb-3 text-sm font-semibold">Trocar contexto docente</p>
                {choices}
              </PopoverContent>
            </Popover>
          )}
          {selected ? (
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {selected.unitName} · {selected.record.role} · vínculo {selected.record.linkId}
            </p>
          ) : null}
        </div>
        {hideDate ? null : (
          <label className="grid w-full grid-cols-1 gap-1 sm:w-auto sm:grid-cols-[auto_auto] sm:items-center sm:gap-2">
            <span className="text-xs font-medium text-muted-foreground">Data de referência</span>
            <Input
              aria-label="Data de referência"
              type="date"
              className="h-8 w-40"
              value={search.data ?? context.referenceDate}
              onChange={(event) => onChange(diarySearch(search, { data: event.target.value }))}
            />
          </label>
        )}
      </div>
    </section>
  );
}

export function PedagogicalAssignmentIdentity({
  item,
}: {
  item: DiaryContext["assignments"][number];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{item.record.role}</span>
      <span>{item.field}</span>
      <span>Vínculo {item.record.linkId}</span>
      <span>
        {item.record.start} — {item.record.end ?? "vigente"}
      </span>
    </div>
  );
}

export function ClassCard({
  item,
  search,
}: {
  item: DiaryContext["assignments"][number];
  search: DiarySearch;
}) {
  return (
    <article className="surface-panel flex min-h-56 flex-col border-t-2 border-t-primary/35 p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-t-primary/70 hover:shadow-float">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="[overflow-wrap:anywhere] text-xs font-semibold text-primary">
            {item.unitName}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{item.className}</h2>
        </div>
        <StatusBadge tone="info">{item.stage}</StatusBadge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{item.field}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border/70 py-3 text-xs">
        <div>
          <span className="block text-muted-foreground">Alunos no contexto</span>
          <strong className="text-foreground">{item.studentCount}</strong>
        </div>
        <div>
          <span className="block text-muted-foreground">Próxima previsão</span>
          <strong className="text-foreground">
            {item.nextBlock
              ? `${dayLabel(item.nextBlock.day)}, ${item.nextBlock.start}`
              : "Sem aula prevista"}
          </strong>
        </div>
      </div>
      <PedagogicalAssignmentIdentity item={item} />
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button asChild size="sm">
          <Link
            to="/diario/turmas/$turmaId"
            params={{ turmaId: item.classId }}
            search={diarySearch(search, {
              turma: item.classId,
              unidade: item.unitId,
              componente: item.field,
            })}
          >
            Abrir Diário <ChevronRight />
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link
            to="/diario/turmas/$turmaId/alunos"
            params={{ turmaId: item.classId }}
            search={diarySearch(search, {
              turma: item.classId,
              unidade: item.unitId,
              componente: item.field,
            })}
          >
            Consultar alunos
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function StudentList({
  students,
  classId,
  search,
}: {
  students: DiaryStudent[];
  classId: string;
  search: DiarySearch;
}) {
  if (!students.length)
    return (
      <EmptyState
        icon={UsersRound}
        title="Nenhum aluno neste contexto"
        description="Não há participação alocada nesta turma na data consultada."
      />
    );
  return (
    <ul className="divide-y divide-border" aria-label="Alunos da turma">
      {students.map((entry) => (
        <li
          key={`${entry.student.id}-${entry.allocation.id}`}
          className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="font-medium text-foreground">{entry.student.personName}</p>
            <p className="text-xs text-muted-foreground">
              {entry.student.sigemId} · {entry.participation.label} · desde{" "}
              {formatAcademicDate(entry.allocation.from)}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link
              to="/diario/turmas/$turmaId/alunos/$alunoId"
              params={{ turmaId: classId, alunoId: entry.student.id }}
              search={search}
            >
              Acompanhar <ChevronRight />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function LessonSummary({ lesson }: { lesson: TaughtLesson }) {
  const context = lessonContext(lesson);
  return (
    <article className="flex gap-3 border-b border-border py-3 last:border-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
        <BookOpenCheck className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {context.klass?.name ?? lesson.classId}
          </h3>
          <StatusBadge tone="neutral">Aula ministrada</StatusBadge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{lesson.summary}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {lesson.date} · {context.assignment?.field ?? "Contexto pedagógico"} · {context.unitName}
        </p>
      </div>
    </article>
  );
}

export function ContextualPending({
  title,
  description,
  icon: Icon = Clock3,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex gap-3 border-l-2 border-warning/55 bg-muted/25 px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
export function LoadingState() {
  return (
    <div aria-label="Carregando" className="space-y-3">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
export function AccessUnavailableState() {
  return (
    <StatePanel
      tone="warning"
      title="Acesso indisponível"
      description="Este contexto dependerá de autorização específica vinculada à atuação pedagógica. Nenhuma permissão real é simulada."
    />
  );
}
export function FutureFeatureState({ title, description }: { title: string; description: string }) {
  return <EmptyState icon={GraduationCap} title={title} description={description} compact />;
}
export function ContextFacts({ item }: { item: DiaryContext["assignments"][number] }) {
  const klass = getDemonstrationClass(item.classId);
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        [Building2, "Escola", item.unitName],
        [GraduationCap, "Etapa", klass?.academicOrganization ?? item.stage],
        [Clock3, "Turno", klass?.shift ?? "Não informado"],
        [CalendarDays, "Período", item.periodLabel],
      ].map(([Icon, label, value]) => {
        const FactIcon = Icon as LucideIcon;
        return (
          <div
            key={String(label)}
            className="border-l border-border/80 pl-3 first:border-l-0 first:pl-0"
          >
            <FactIcon className="mb-2 size-4 text-primary" />
            <dt className="text-xs text-muted-foreground">{String(label)}</dt>
            <dd className="min-w-0 [overflow-wrap:anywhere] text-sm font-medium text-foreground">
              {String(value)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
