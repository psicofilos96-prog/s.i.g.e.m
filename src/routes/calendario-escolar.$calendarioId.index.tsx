import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CalendarWorkspacePage, type CalendarProfile } from "@/features/calendar/calendar-pages";

export const Route = createFileRoute("/calendario-escolar/$calendarioId/")({
  validateSearch: z.object({ perfil: z.enum(["supervisao", "escola", "professor"]).optional() }),
  head: () => ({
    meta: [
      { title: "Calendário escolar — SIGEM" },
      { name: "description", content: "Elaboração, revisão e consulta do calendário escolar da rede." },
      { property: "og:title", content: "Calendário escolar — SIGEM" },
      { property: "og:description", content: "Calendário da rede com dias letivos, feriados, períodos e Conselhos de Classe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { calendarioId } = Route.useParams();
  const { perfil } = Route.useSearch();
  return <CalendarWorkspacePage calendarId={calendarioId} profile={(perfil ?? "supervisao") as CalendarProfile} />;
}
