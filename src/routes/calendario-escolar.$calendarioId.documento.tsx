import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CalendarDocumentRoute } from "@/features/calendar/institutional-calendar-routes";

/** B4.6.2a — fronteira de sessão: com sessão só consulta institucional; sem sessão, laboratório. */
export const Route = createFileRoute("/calendario-escolar/$calendarioId/documento")({
  validateSearch: z.object({ perfil: z.enum(["supervisao", "escola", "professor"]).optional() }),
  head: () => ({
    meta: [
      { title: "Documento do calendário escolar — SIGEM" },
      { name: "description", content: "Documento de consulta de um calendário escolar." },
      { property: "og:title", content: "Documento do calendário escolar — SIGEM" },
      { property: "og:description", content: "Documento de consulta de um calendário escolar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { calendarioId } = Route.useParams();
  const { perfil } = Route.useSearch();
  return <CalendarDocumentRoute calendarId={calendarioId} perfil={perfil} />;
}
