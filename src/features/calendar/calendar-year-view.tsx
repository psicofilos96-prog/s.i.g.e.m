/**
 * Visão anual do calendário — componentes de apresentação puros.
 * Compartilhados entre a página interativa e a versão de impressão.
 */
import { memo, useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import {
  formatAcademicDate,
  formatAcademicDateLong,
  MONTH_NAMES,
  monthGrid,
  monthsCovering,
  WEEKDAY_NAMES,
  addDays,
  type IsoDate,
  type MonthRef,
} from "@/lib/academic-date";
import type { AssessmentPeriod, AssessmentPeriodStructure } from "@/features/assessment/assessment-types";
import type { CalendarIndex } from "./calendar-rules";
import { categoryUsage, schoolDaysByPeriod } from "./calendar-rules";
import type { DayCategory, DayResolution } from "./calendar-types";

export const STATUS_TEXT: Record<DayResolution["status"], string> = {
  letivo: "Dia letivo",
  "nao-letivo": "Não letivo",
  "sem-classificacao": "Sem classificação",
  "fora-da-vigencia": "Fora da vigência",
};

export function periodMap(structure: AssessmentPeriodStructure | null) {
  const map = new Map<IsoDate, AssessmentPeriod>();
  const starts = new Set<IsoDate>();
  if (!structure) return { map, starts };
  for (const p of structure.periods) {
    starts.add(p.start);
    for (let d = p.start; d <= p.end; d = addDays(d, 1)) map.set(d, p);
  }
  return { map, starts };
}

export function dayDescription(day: DayResolution, period: AssessmentPeriod | undefined) {
  const parts = [formatAcademicDateLong(day.date), STATUS_TEXT[day.status]];
  if (day.classification && day.classification.id !== "cat-letivo")
    parts.push(day.classifyingEvent?.title ?? day.classification.label);
  for (const m of day.markers) parts.push(`${m.category.label}: ${m.event.title}`);
  if (period) parts.push(period.label);
  return parts.join(" — ");
}

function toneClass(day: DayResolution) {
  if (day.status === "fora-da-vigencia") return "cal-out";
  if (day.status === "sem-classificacao") return "cal-none";
  return `cal-tone-${day.classification!.tone} ${day.status === "nao-letivo" ? "cal-off" : ""}`;
}

type MonthProps = {
  month: MonthRef;
  index: CalendarIndex;
  periods: ReturnType<typeof periodMap>;
  signature: string;
  activeDate: IsoDate | null;
  selectedDate: IsoDate | null;
  interactive: boolean;
  hiddenOnMobile?: boolean;
};

function MonthGridImpl({ month, index, periods, activeDate, selectedDate, interactive, hiddenOnMobile }: MonthProps) {
  const cells = monthGrid(month.year, month.month);
  const title = `${MONTH_NAMES[month.month - 1]} ${month.year}`;
  const schoolDays = cells.filter((d) => d && index.days.get(d)?.status === "letivo").length;
  return (
    <section
      aria-label={title}
      className={cn("cal-month min-w-0", hiddenOnMobile && "max-md:hidden print:block")}
    >
      <header className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-border/70 pb-1">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
          {MONTH_NAMES[month.month - 1]}
        </h3>
        <p className="text-[0.6875rem] tabular-nums text-muted-foreground">
          {schoolDays} <span className="sr-only">dias letivos</span>
          <span aria-hidden>letivos</span>
        </p>
      </header>
      <div role="grid" aria-label={title} className="grid grid-cols-7 gap-px text-center">
        <div role="row" className="contents">
          {WEEKDAY_NAMES.map((name) => (
            <abbr
              key={name}
              role="columnheader"
              title={name}
              className="pb-0.5 text-[0.625rem] font-semibold uppercase text-muted-foreground no-underline"
            >
              {name[0]}
            </abbr>
          ))}
        </div>
        <div role="row" className="contents">
          {cells.map((date, i) => {
            if (!date) return <span key={`e-${i}`} role="gridcell" aria-hidden />;
            const day = index.days.get(date)!;
            const period = periods.map.get(date);
            const label = dayDescription(day, period);
            const cls = cn(
              "cal-day relative grid aspect-square min-h-7 place-items-center rounded-[3px] text-xs tabular-nums",
              toneClass(day),
              day.markers.length > 0 && "cal-marker",
              periods.starts.has(date) && "cal-period-start",
              selectedDate === date && "cal-selected",
            );
            return (
              <span key={date} role="gridcell" className="min-w-0">
                {interactive ? (
                  <button
                    type="button"
                    data-date={date}
                    tabIndex={activeDate === date ? 0 : -1}
                    aria-label={label}
                    aria-pressed={selectedDate === date}
                    title={label}
                    className={cn(cls, "w-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring")}
                  >
                    {Number(date.slice(8))}
                  </button>
                ) : (
                  <span className={cn(cls, "w-full")} aria-label={label} title={label}>
                    {Number(date.slice(8))}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const MonthGrid = memo(
  MonthGridImpl,
  (a, b) =>
    a.month.key === b.month.key &&
    a.signature === b.signature &&
    a.activeDate === b.activeDate &&
    a.selectedDate === b.selectedDate &&
    a.interactive === b.interactive &&
    a.hiddenOnMobile === b.hiddenOnMobile &&
    a.periods === b.periods,
);

function monthSignature(index: CalendarIndex, month: MonthRef) {
  let sig = "";
  for (const date of monthGrid(month.year, month.month)) {
    if (!date) continue;
    const d = index.days.get(date)!;
    sig += `${d.status[0]}${d.classification?.id ?? ""}${d.markers.length};`;
  }
  return sig;
}

export function YearGrid({
  index,
  structure,
  interactive,
  activeDate,
  selectedDate,
  mobileMonthKey,
  onSelect,
  onActiveChange,
}: {
  index: CalendarIndex;
  structure: AssessmentPeriodStructure | null;
  interactive: boolean;
  activeDate?: IsoDate | null;
  selectedDate?: IsoDate | null;
  mobileMonthKey?: string;
  onSelect?: (date: IsoDate) => void;
  onActiveChange?: (date: IsoDate) => void;
}) {
  const months = useMemo(
    () => monthsCovering(index.year.validity.start, index.year.validity.end),
    [index.year.validity.start, index.year.validity.end],
  );
  const periods = useMemo(() => periodMap(structure), [structure]);
  const signatures = useMemo(() => months.map((m) => monthSignature(index, m)), [index, months]);

  // Um único listener para toda a grade (delegação), não um por célula.
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-date]");
    if (target?.dataset.date) onSelect?.(target.dataset.date);
  };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-date]");
    const date = target?.dataset.date;
    if (!date) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!step) return;
    const next = addDays(date, step);
    const el = event.currentTarget.querySelector<HTMLElement>(`[data-date="${next}"]`);
    if (!el) return;
    event.preventDefault();
    onActiveChange?.(next);
    requestAnimationFrame(() => el.focus());
  };

  const active = activeDate ?? null;
  return (
    <div
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKey : undefined}
      className="cal-year grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
    >
      {months.map((month, i) => (
        <MonthGrid
          key={month.key}
          month={month}
          index={index}
          periods={periods}
          signature={signatures[i]!}
          activeDate={active && active.startsWith(month.key) ? active : null}
          selectedDate={selectedDate && selectedDate.startsWith(month.key) ? selectedDate : null}
          interactive={interactive}
          hiddenOnMobile={Boolean(mobileMonthKey) && mobileMonthKey !== month.key}
        />
      ))}
    </div>
  );
}

/** Legenda textual: cor + marca + nome + contagem (não depende só de cor). */
export function CalendarLegend({ index, compact }: { index: CalendarIndex; compact?: boolean }) {
  const usage = categoryUsage(index);
  const used = [...index.categories.values()].filter((c) => usage.has(c.id));
  return (
    <ul aria-label="Legenda do calendário" className={cn("flex min-w-0 flex-wrap gap-x-4 gap-y-1.5 text-xs", compact && "gap-x-3")}>
      {used.map((category) => (
        <LegendItem key={category.id} category={category} count={usage.get(category.id) ?? 0} />
      ))}
      <li className="flex items-center gap-1.5 text-muted-foreground">
        <span aria-hidden className="cal-day cal-none inline-grid size-4 place-items-center rounded-[3px] border border-border text-[0.5rem]">·</span>
        Sem classificação
      </li>
    </ul>
  );
}
function LegendItem({ category, count }: { category: DayCategory; count: number }) {
  return (
    <li className="flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          "cal-day inline-grid size-4 shrink-0 place-items-center rounded-[3px] text-[0.5rem] font-bold",
          `cal-tone-${category.tone}`,
          category.effect === "nao-letivo" && "cal-off",
          category.effect === "marcador" && "cal-marker cal-none border border-border",
        )}
      >
        {category.mark}
      </span>
      <span className="text-foreground">{category.label}</span>
      <span className="tabular-nums text-muted-foreground">
        {count} <span className="sr-only">{count === 1 ? "dia" : "dias"}</span>
      </span>
    </li>
  );
}

/** Faixa dos períodos com dias letivos — nomes vêm dos dados. */
export function PeriodDistribution({ index, structure }: { index: CalendarIndex; structure: AssessmentPeriodStructure }) {
  const rows = schoolDaysByPeriod(index, structure);
  const total = rows.reduce((s, r) => s + r.schoolDays, 0) || 1;
  return (
    <ol aria-label={`Dias letivos por período — ${structure.label}`} className="flex min-w-0 flex-col gap-1.5 md:flex-row md:gap-1">
      {rows.map(({ period, schoolDays }) => (
        <li
          key={period.id}
          style={{ flexGrow: Math.max(schoolDays, 1), flexBasis: 0 }}
          className="min-w-0 border-l-4 border-primary/60 bg-secondary/45 px-3 py-2 md:border-l-0 md:border-t-4 print:border-t-2"
        >
          <p className="break-words text-sm font-semibold text-foreground">{period.label}</p>
          <p className="text-xs text-muted-foreground">
            {formatAcademicDate(period.start)} — {formatAcademicDate(period.end)}
          </p>
          <p className="text-xs tabular-nums text-foreground">
            {schoolDays} dias letivos · {Math.round((schoolDays / total) * 100)}%
          </p>
        </li>
      ))}
    </ol>
  );
}
