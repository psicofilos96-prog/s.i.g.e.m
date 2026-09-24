import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Eye,
  FlaskConical,
  PencilLine,
  Printer,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { academicYears } from "@/features/academic/academic-structure";
import { NormativeBadge } from "@/features/assessment/assessment-structure-page";
import { periodStructures } from "@/features/assessment/assessment-fixtures";
import type { AssessmentPeriodStructure } from "@/features/assessment/assessment-types";
import {
  formatAcademicDate,
  formatAcademicDateLong,
  MONTH_NAMES,
  monthsCovering,
  type IsoDate,
} from "@/lib/academic-date";
import { dayCategories } from "./calendar-fixtures";
import {
  buildCalendarIndex,
  calendarForYear,
  calendarPermissions,
  calendarState,
  countSchoolDays,
  eventsOn,
  periodForDate,
  validateCalendar,
  validateCalendarPeriods,
  type CalendarIndex,
  type CalendarState,
  type CalendarViewer,
} from "./calendar-rules";
import { calendarRepository, useCalendarEvents } from "./calendar-store";
import { CalendarLegend, PeriodDistribution, YearGrid } from "./calendar-year-view";
import {
  CALENDAR_STATE_COPY,
  STATUS_TEXT,
  structuresForYear,
  useCalendarIndex,
} from "./calendar-view-model";

export type CalendarSearch = { estrutura?: string; perfil?: string; dia?: string };

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

export function SchoolCalendarPage({ yearId, search }: { yearId: string; search: CalendarSearch }) {
  const { resolved, index, issues } = useCalendarIndex(yearId);
  const structures = structuresForYear(yearId);
  const structure = structures.find((s) => s.id === search.estrutura) ?? structures[0] ?? null;
  const viewer: CalendarViewer = search.perfil === "secretaria" ? "secretaria" : "professor";
  const permissions = calendarPermissions(viewer);

  const yearNav = (
    <nav aria-label="Anos letivos" className="flex flex-wrap gap-1.5">
      {academicYears.map((y) => (
        <Button key={y.id} asChild size="sm" variant={y.id === yearId ? "default" : "outline"}>
          <Link
            to="/calendario-escolar/$anoId"
            params={{ anoId: y.id }}
            search={{ perfil: search.perfil }}
          >
            {y.civilYear}
          </Link>
        </Button>
      ))}
    </nav>
  );

  if (!resolved)
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Gestão institucional · Calendário escolar"
          title="Ano letivo não encontrado"
        />
        <StatePanel
          tone="danger"
          title="Ano letivo inexistente"
          description="O identificador informado não corresponde a nenhum ano letivo."
        />
        {yearNav}
      </div>
    );

  const { year, calendar } = resolved;
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow="Gestão institucional · Calendário escolar"
        title={year.label}
        description={`Organização dos dias do ano letivo. Vigência ${formatAcademicDate(year.validity.start)} — ${formatAcademicDate(year.validity.end)}.`}
        actions={
          index ? (
            <Button asChild size="sm" variant="outline">
              <Link
                to="/calendario-escolar/$anoId/impressao"
                params={{ anoId: yearId }}
                search={{ estrutura: structure?.id }}
              >
                <Printer /> Versão de impressão
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        {yearNav}
        {index ? (
          <Button asChild size="sm" variant="outline" className="sm:hidden">
            <Link
              to="/calendario-escolar/$anoId/impressao"
              params={{ anoId: yearId }}
              search={{ estrutura: structure?.id }}
            >
              <Printer /> Impressão
            </Link>
          </Button>
        ) : null}
      </div>
      {!index ? (
        <StatePanel
          tone="neutral"
          title={CALENDAR_STATE_COPY["nao-cadastrado"].title}
          description={`${calendar.label}: ${CALENDAR_STATE_COPY["nao-cadastrado"].text} Nenhum dia é presumido letivo a partir do calendário civil.`}
        />
      ) : (
        <CalendarWorkspace
          index={index}
          issues={issues}
          structure={structure}
          structures={structures}
          yearId={yearId}
          search={search}
          viewer={viewer}
          editLocal={permissions.editLocal}
          permissionReason={permissions.reason}
        />
      )}
    </div>
  );
}

function CalendarWorkspace({
  index,
  issues,
  structure,
  structures,
  yearId,
  search,
  viewer,
  editLocal,
  permissionReason,
}: {
  index: CalendarIndex;
  issues: ReturnType<typeof validateCalendar>;
  structure: AssessmentPeriodStructure | null;
  structures: AssessmentPeriodStructure[];
  yearId: string;
  search: CalendarSearch;
  viewer: CalendarViewer;
  editLocal: boolean;
  permissionReason: string;
}) {
  const wide = useWide();
  const months = monthsCovering(index.year.validity.start, index.year.validity.end);
  const [selected, setSelected] = useState<IsoDate | null>(
    search.dia && index.days.has(search.dia) ? search.dia : null,
  );
  const [active, setActive] = useState<IsoDate>(selected ?? index.year.validity.start);
  const [mobileMonth, setMobileMonth] = useState(active.slice(0, 7));
  const [sheetOpen, setSheetOpen] = useState(false);
  const periodIssues = useMemo(
    () => (structure ? validateCalendarPeriods(index, structure) : []),
    [index, structure],
  );
  const allIssues = [...issues, ...periodIssues];
  const state = calendarState(index, allIssues);
  const copy = CALENDAR_STATE_COPY[state];
  const total = countSchoolDays(index, index.year.validity.start, index.year.validity.end);
  const errors = allIssues.filter((i) => i.severity === "erro");

  const select = useCallback(
    (date: IsoDate) => {
      setSelected(date);
      setActive(date);
      setMobileMonth(date.slice(0, 7));
      if (!wide) setSheetOpen(true);
    },
    [wide],
  );
  const monthIdx = Math.max(
    0,
    months.findIndex((m) => m.key === mobileMonth),
  );
  const goMonth = (delta: number) => {
    const m = months[Math.min(months.length - 1, Math.max(0, monthIdx + delta))]!;
    setMobileMonth(m.key);
    setActive(`${m.key}-01`);
  };

  const panel = (
    <DayPanel
      index={index}
      date={selected}
      structure={structure}
      editLocal={editLocal}
      onSelect={select}
      onClear={() => setSelected(null)}
    />
  );

  return (
    <div className="min-w-0">
      <div
        role="status"
        className="grid min-w-0 gap-3 border-y border-border/70 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
      >
        <div className="flex min-w-0 items-start gap-3">
          {state === "homologado" ? (
            <Eye aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          ) : state === "demonstrativo" ? (
            <FlaskConical aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          ) : (
            <CircleDashed aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{copy.title}</p>
            <p className="text-sm text-muted-foreground">{copy.text}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <NormativeBadge status={index.calendar.normativeStatus} />
          <StatusBadge tone={state === "homologado" ? "success" : "warning"}>
            {state === "homologado" ? "Oficial" : "Não oficial"}
          </StatusBadge>
          <nav aria-label="Modo de acesso demonstrativo" className="flex gap-1">
            <Button
              asChild
              size="sm"
              variant={viewer === "professor" ? "secondary" : "ghost"}
              className="h-7"
            >
              <Link
                to="/calendario-escolar/$anoId"
                params={{ anoId: yearId }}
                search={{ ...search, perfil: undefined }}
                aria-current={viewer === "professor" ? "true" : undefined}
              >
                <Eye /> Consulta
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={viewer === "secretaria" ? "secondary" : "ghost"}
              className="h-7"
            >
              <Link
                to="/calendario-escolar/$anoId"
                params={{ anoId: yearId }}
                search={{ ...search, perfil: "secretaria" }}
                aria-current={viewer === "secretaria" ? "true" : undefined}
              >
                <PencilLine /> Ajuste local
              </Link>
            </Button>
          </nav>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{permissionReason}</p>

      <dl className="mt-4 grid min-w-0 gap-x-8 gap-y-3 border-b border-border/70 pb-4 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">
            Dias letivos no ano (demonstrativo)
          </dt>
          <dd className="font-display text-2xl font-semibold tabular-nums text-foreground">
            {total}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">Inconsistências</dt>
          <dd className="font-display text-2xl font-semibold tabular-nums text-foreground">
            {errors.length}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {allIssues.length - errors.length
                ? `+ ${allIssues.length - errors.length} observação(ões)`
                : ""}
            </span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">Legenda</dt>
          <dd className="mt-1">
            <CalendarLegend index={index} />
          </dd>
        </div>
      </dl>

      {structure ? (
        <section aria-labelledby="cal-periods" className="border-b border-border/70 py-4">
          <div className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-2">
            <h2 id="cal-periods" className="font-display text-base font-semibold text-foreground">
              Períodos avaliativos vinculados ·{" "}
              <span className="font-normal">{structure.label}</span>
            </h2>
            {structures.length > 1 ? (
              <nav aria-label="Estruturas de períodos" className="flex flex-wrap gap-1">
                {structures.map((s) => (
                  <Button
                    key={s.id}
                    asChild
                    size="sm"
                    variant={s.id === structure.id ? "secondary" : "ghost"}
                    className="h-7"
                  >
                    <Link
                      to="/calendario-escolar/$anoId"
                      params={{ anoId: yearId }}
                      search={{ ...search, estrutura: s.id }}
                    >
                      {s.label}
                    </Link>
                  </Button>
                ))}
              </nav>
            ) : null}
          </div>
          <PeriodDistribution index={index} structure={structure} />
          <p className="mt-2 text-xs text-muted-foreground">
            Datas dos períodos vêm da estrutura avaliativa; o calendário apenas as exibe. O marcador
            no canto do dia indica início de período.
          </p>
        </section>
      ) : null}

      {allIssues.length ? (
        <details className="border-b border-border/70 py-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle aria-hidden className="size-4 text-warning-foreground" />
            Inconsistências e observações estruturais ({allIssues.length})
          </summary>
          <ul className="mt-2 space-y-1 text-sm">
            {allIssues.map((issue, i) => (
              <li key={`${issue.code}-${i}`} className="break-words">
                <strong className="font-semibold">
                  {issue.severity === "erro" ? "Erro" : "Observação"}:
                </strong>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-5 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2 md:hidden">
            <Button
              size="icon"
              variant="outline"
              aria-label="Mês anterior"
              disabled={monthIdx === 0}
              onClick={() => goMonth(-1)}
            >
              <ChevronLeft />
            </Button>
            <p className="font-display text-base font-semibold" aria-live="polite">
              {MONTH_NAMES[months[monthIdx]!.month - 1]} {months[monthIdx]!.year}
            </p>
            <Button
              size="icon"
              variant="outline"
              aria-label="Próximo mês"
              disabled={monthIdx === months.length - 1}
              onClick={() => goMonth(1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <YearGrid
            index={index}
            structure={structure}
            interactive
            activeDate={active}
            selectedDate={selected}
            mobileMonthKey={mobileMonth}
            onSelect={select}
            onActiveChange={setActive}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Setas do teclado percorrem os dias; Enter abre o detalhe. Dias hachurados não são
            letivos; ponto indica evento.
          </p>
        </div>
        {wide ? (
          <aside
            aria-label="Detalhe do dia"
            className="min-w-0 xl:sticky xl:top-[calc(var(--topbar-height)+1rem)] xl:max-h-[calc(100vh-var(--topbar-height)-2rem)] xl:self-start xl:overflow-y-auto border-l border-border/70 pl-5"
          >
            {panel}
          </aside>
        ) : null}
      </div>
      {!wide ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {selected ? formatAcademicDateLong(selected) : "Detalhe do dia"}
              </SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">{panel}</div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

function DayPanel({
  index,
  date,
  structure,
  editLocal,
  onSelect,
  onClear,
}: {
  index: CalendarIndex;
  date: IsoDate | null;
  structure: AssessmentPeriodStructure | null;
  editLocal: boolean;
  onSelect: (date: IsoDate) => void;
  onClear: () => void;
}) {
  const [announce, setAnnounce] = useState("");
  if (!date) {
    const notable = index.events
      .filter((e) => !e.weekdays)
      .sort((a, b) => (a.start < b.start ? -1 : 1));
    return (
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-foreground">Eventos do ano</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Selecione um dia para consultar{editLocal ? " ou ajustar" : ""}.
        </p>
        <ul className="divide-y divide-border/70">
          {notable.map((e) => {
            const category = index.categories.get(e.categoryId);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onSelect(e.start)}
                  className="w-full py-2 text-left text-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="block text-xs text-muted-foreground">
                    {formatAcademicDate(e.start)}
                    {e.end !== e.start ? ` — ${formatAcademicDate(e.end)}` : ""} · {category?.label}
                  </span>
                  <span className="break-words">{e.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  const day = index.days.get(date)!;
  const period = structure ? periodForDate(structure, date) : null;
  const events = eventsOn(index, date);
  const local = events.find((e) => e.event.local);
  const apply = (value: string) => {
    calendarRepository.setDayCategory(index.calendar.id, date, value || null);
    const label = dayCategories.find((c) => c.id === value)?.label;
    setAnnounce(label ? `Dia ajustado localmente para ${label}.` : "Ajuste local removido.");
  };
  return (
    <div className="min-w-0 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Dia selecionado</p>
        <h2 className="font-display text-base font-semibold first-letter:uppercase text-foreground">
          {formatAcademicDateLong(date)}
        </h2>
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Condição</dt>
          <dd className="font-medium text-foreground">
            {STATUS_TEXT[day.status]}
            {day.suspended ? " · atividades suspensas" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Período avaliativo</dt>
          <dd className="text-foreground">
            {period ? period.label : "Nenhum período contém esta data"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Classificação e eventos</dt>
          <dd>
            {events.length ? (
              <ul className="space-y-1">
                {events.map(({ event, category }) => (
                  <li key={event.id} className="break-words text-foreground">
                    <span className="font-medium">{category.label}</span> — {event.title}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground">
                Nenhuma classificação cadastrada. O dia não é presumido letivo.
              </span>
            )}
          </dd>
        </div>
      </dl>
      {editLocal && day.inValidity ? (
        <div className="border-t border-border/70 pt-3">
          <label htmlFor="cal-day-category" className="text-xs font-medium text-muted-foreground">
            Ajuste local deste dia (não é salvo nem publicado)
          </label>
          <select
            id="cal-day-category"
            value={local?.category.id ?? ""}
            onChange={(e) => apply(e.target.value)}
            className="mt-1 h-9 w-full min-w-0 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="">Sem ajuste local</option>
            {dayCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <p aria-live="polite" className="mt-1 text-xs text-muted-foreground">
            {announce}
          </p>
        </div>
      ) : null}
      <Button size="sm" variant="ghost" onClick={onClear}>
        Ver eventos do ano
      </Button>
    </div>
  );
}
