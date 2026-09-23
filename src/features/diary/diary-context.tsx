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
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
        className="mt-4 flex gap-1 overflow-x-auto overscroll-x-contain border-t border-border/50 pt-2"
      >
        <Button asChild variant="ghost" size="sm" className="shrink-0 whitespace-nowrap">
          <Link to="/diario">Meu Diário</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="shrink-0 whitespace-nowrap">
          <Link to="/diario/turmas">Minhas turmas</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="shrink-0 whitespace-nowrap">
          <Link to="/diario/registrar">Registrar aula</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="shrink-0 whitespace-nowrap">
          <Link to="/diario/aulas">Histórico de aulas</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="shrink-0 whitespace-nowrap">
          <Link to="/diario/chamadas">Chamadas</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="shrink-0 whitespace-nowrap">
          <Link to="/diario/frequencia">Frequência</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="shrink-0 whitespace-nowrap">
          <Link to="/diario/documentos">Documentos</Link>
        </Button>
      </nav>
    </header>
  );
}

function Selector({
  label,
  value,
  options,
  onValueChange,
  allLabel,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
  allLabel: string;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value ?? "all"} onValueChange={onValueChange}>
        <SelectTrigger className="w-full bg-card">
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
export function AcademicContextSelector({
  context,
  search,
  onChange,
  compact = false,
}: {
  context: DiaryContext;
  search: DiarySearch;
  onChange: (value: DiarySearch) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const apply = (key: keyof DiarySearch, value: string) =>
    onChange(diarySearch(search, { [key]: value === "all" ? undefined : value }));
  const labelOf = (list: Array<{ value: string; label: string }>, v?: string) =>
    v ? (list.find((item) => item.value === v)?.label ?? v) : undefined;
  const summary = [
    labelOf(context.units, search.unidade) ?? "Todas as escolas",
    labelOf(context.classes, search.turma) ?? "Todas as turmas",
    search.componente ?? "Todos os componentes",
    ...(search.ano ? [`Ano ${search.ano}`] : []),
    ...(search.periodo ? [search.periodo] : []),
  ];
  const activeFilters = [
    search.unidade,
    search.turma,
    search.componente,
    search.ano,
    search.periodo,
  ].filter(Boolean).length;
  return (
    <section
      aria-label="Contexto acadêmico"
      className={cn(
        "border-y border-border/70 bg-card/75 px-3 py-3 shadow-panel sm:rounded-md sm:border",
        context.historical && "border-dashed",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Contexto</span>
          {summary.map((item) => (
            <span
              key={item}
              className="max-w-full rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground [overflow-wrap:anywhere]"
            >
              {item}
            </span>
          ))}
          {context.historical ? (
            <StatusBadge tone="warning">Consulta histórica · somente leitura</StatusBadge>
          ) : null}
        </div>
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls="diary-advanced-filters"
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal /> Filtros{activeFilters ? ` (${activeFilters})` : ""}
        </Button>
      </div>
      {open ? (
        <div
          id="diary-advanced-filters"
          className={cn(
            "mt-3 grid gap-3 border-t border-border pt-3",
            compact ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-5",
          )}
        >
          <Selector
            label="Escola"
            value={search.unidade}
            options={context.units}
            allLabel="Todas as escolas"
            onValueChange={(v) => apply("unidade", v)}
          />
          <Selector
            label="Turma"
            value={search.turma}
            options={context.classes}
            allLabel="Todas as turmas"
            onValueChange={(v) => apply("turma", v)}
          />
          <Selector
            label="Componente ou campo"
            value={search.componente}
            options={context.fields}
            allLabel="Todos"
            onValueChange={(v) => apply("componente", v)}
          />
          <Selector
            label="Ano letivo"
            value={search.ano}
            options={context.years.map((v) => ({ value: v, label: v }))}
            allLabel="Todos os anos"
            onValueChange={(v) => apply("ano", v)}
          />
          {!compact ? (
            <Selector
              label="Período acadêmico"
              value={search.periodo}
              options={context.periods.map((v) => ({ value: v, label: v }))}
              allLabel="Todos os períodos"
              onValueChange={(v) => apply("periodo", v)}
            />
          ) : null}
        </div>
      ) : null}
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
              {entry.student.sigemId} · {entry.participation.label} · desde {entry.allocation.from}
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
