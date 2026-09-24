import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StatePanel } from "@/components/sigem/patterns";
import {
  CalendarBackLink,
  CalendarPrintDocument,
  CalendarPrintToolbar,
} from "@/features/calendar/calendar-print-view";
import { calendarState, validateCalendarPeriods } from "@/features/calendar/calendar-rules";
import { structuresForYear, useCalendarIndex } from "@/features/calendar/calendar-view-model";

export const Route = createFileRoute("/calendario-escolar/$anoId/impressao")({
  validateSearch: z.object({ estrutura: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Calendário escolar para impressão — SIGEM" },
      {
        name: "description",
        content: "Versão anual do calendário escolar preparada para impressão A4.",
      },
      { property: "og:title", content: "Calendário escolar para impressão — SIGEM" },
      { property: "og:description", content: "Calendário anual com legenda, períodos e eventos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { anoId } = Route.useParams();
  const { estrutura } = Route.useSearch();
  const { index, issues } = useCalendarIndex(anoId);
  const structures = structuresForYear(anoId);
  const structure = structures.find((s) => s.id === estrutura) ?? structures[0] ?? null;
  return (
    <div className="space-y-5 pb-6">
      <CalendarPrintToolbar back={<CalendarBackLink yearId={anoId} />} />
      {index ? (
        <CalendarPrintDocument
          index={index}
          structure={structure}
          official={
            calendarState(index, [
              ...issues,
              ...(structure ? validateCalendarPeriods(index, structure) : []),
            ]) === "homologado"
          }
        />
      ) : (
        <StatePanel
          tone="neutral"
          title="Calendário não cadastrado"
          description="Não há calendário para imprimir neste ano letivo."
        />
      )}
    </div>
  );
}
