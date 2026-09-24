import { Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/branding";
import type { AssessmentPeriodStructure } from "@/features/assessment/assessment-types";
import { formatAcademicDate } from "@/lib/academic-date";
import { countSchoolDays, type CalendarIndex } from "./calendar-rules";
import { CalendarLegend, PeriodDistribution, YearGrid } from "./calendar-year-view";

/** Documento estático: nenhum controle interativo dentro do artigo. */
export function CalendarPrintDocument({
  index,
  structure,
  official,
}: {
  index: CalendarIndex;
  structure: AssessmentPeriodStructure | null;
  official: boolean;
}) {
  const { year } = index;
  const events = index.events.filter((e) => !e.weekdays).sort((a, b) => (a.start < b.start ? -1 : 1));
  return (
    <article aria-label="Calendário para impressão" className="cal-print mx-auto max-w-[1180px] border border-border bg-card p-6 shadow-panel print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <header className="border-b border-border pb-3 text-center">
        <p className="text-xs uppercase text-muted-foreground">Prefeitura Municipal de Itaperuna · Secretaria Municipal de Educação</p>
        <p className="text-xs uppercase text-muted-foreground">{brand.displayName}</p>
        <h1 className="mt-2 font-display text-xl font-semibold">Calendário escolar — {year.label}</h1>
        <p className="text-sm text-muted-foreground">
          Vigência {formatAcademicDate(year.validity.start)} — {formatAcademicDate(year.validity.end)} ·{" "}
          {countSchoolDays(index, year.validity.start, year.validity.end)} dias letivos
        </p>
        {!official ? (
          <p className="mt-1 text-xs font-semibold uppercase text-warning-foreground">Demonstrativo — não é o calendário oficial da rede</p>
        ) : null}
      </header>
      <div className="mt-3">
        <CalendarLegend index={index} compact />
      </div>
      <div className="mt-4">
        <YearGrid index={index} structure={structure} interactive={false} />
      </div>
      {structure ? (
        <section className="cal-print-block mt-4">
          <h2 className="mb-1.5 text-sm font-semibold">Períodos avaliativos · {structure.label}</h2>
          <PeriodDistribution index={index} structure={structure} />
        </section>
      ) : null}
      {events.length ? (
        <section className="cal-print-block mt-4">
          <h2 className="mb-1 text-sm font-semibold">Eventos e datas</h2>
          <ul className="columns-1 gap-6 text-xs sm:columns-2 print:columns-3">
            {events.map((e) => (
              <li key={e.id} className="break-inside-avoid py-0.5">
                <span className="tabular-nums text-muted-foreground">
                  {formatAcademicDate(e.start)}
                  {e.end !== e.start ? ` — ${formatAcademicDate(e.end)}` : ""}
                </span>{" "}
                · {index.categories.get(e.categoryId)?.label}: {e.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

export function CalendarPrintToolbar({ back }: { back: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <p className="text-xs text-muted-foreground">Pré-visualização A4 paisagem. Demonstrativo enquanto não houver homologação.</p>
      <div className="flex gap-2">
        {back}
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer /> Imprimir
        </Button>
      </div>
    </div>
  );
}

export function CalendarBackLink({ yearId }: { yearId: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link to="/calendario-escolar/$anoId" params={{ anoId: yearId }}>
        Voltar
      </Link>
    </Button>
  );
}
