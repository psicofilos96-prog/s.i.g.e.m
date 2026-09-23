import { Link } from "@tanstack/react-router";
import {
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  GraduationCap,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
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
import { cn } from "@/lib/utils";
import {
  dayLabel,
  diaryContext,
  type DiaryContext,
  type DiarySearch,
  type DiaryStudent,
  type TaughtLesson,
  lessonContext,
} from "./diary-data";

export function diarySearch(search: DiarySearch, changes: Partial<DiarySearch>): DiarySearch {
  return { ...search, ...changes };
}

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
    <header className="border-b border-border pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase text-primary">
            Diário Inteligente · ambiente demonstrativo
          </p>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={context.historical ? "neutral" : "success"}>
            {context.historical ? "Consulta histórica" : "Contexto atual"}
          </StatusBadge>
          {children}
        </div>
      </div>
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
  const apply = (key: keyof DiarySearch, value: string) =>
    onChange(diarySearch(search, { [key]: value === "all" ? undefined : value }));
  return (
    <section aria-label="Contexto acadêmico" className="surface-panel p-3">
      <div
        className={cn(
          "grid gap-3",
          compact ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-6",
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
        <label>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Data de referência
          </span>
          <Input
            aria-label="Data de referência"
            type="date"
            value={search.data ?? context.referenceDate}
            onChange={(event) => onChange(diarySearch(search, { data: event.target.value }))}
          />
        </label>
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
    <article className="surface-panel flex min-h-56 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-primary">{item.unitName}</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{item.className}</h2>
        </div>
        <StatusBadge tone="info">{item.stage}</StatusBadge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{item.field}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border py-3 text-xs">
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
    <div className="flex gap-3 rounded-md border border-border bg-muted/30 p-3">
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
  const klass = getDemonstrationClassSafe(item.classId);
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
          <div key={String(label)} className="rounded-md border border-border p-3">
            <FactIcon className="mb-2 size-4 text-primary" />
            <dt className="text-xs text-muted-foreground">{String(label)}</dt>
            <dd className="text-sm font-medium text-foreground">{String(value)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
function getDemonstrationClassSafe(id: string) {
  return diaryContext().assignments.find((item) => item.classId === id)
    ? getClass(id)
    : getClass(id);
}
function getClass(id: string) {
  return getDemonstrationClassImported(id);
}
import { getDemonstrationClass as getDemonstrationClassImported } from "@/features/classes/classes-data";
