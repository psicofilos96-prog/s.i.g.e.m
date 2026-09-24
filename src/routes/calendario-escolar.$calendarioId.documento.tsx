import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CalendarPrintPage, type CalendarProfile } from "@/features/calendar/calendar-pages";

export const Route = createFileRoute("/calendario-escolar/$calendarioId/documento")({
  validateSearch: z.object({ perfil: z.enum(["supervisao", "escola", "professor"]).optional() }),
  head: () => ({
    meta: [
      { title: "Documento Calendário Escolar — SIGEM" },
      {
        name: "description",
        content: "Documento Calendário Escolar em A4 paisagem, no modelo da Supervisão de Ensino.",
      },
      { property: "og:title", content: "Documento Calendário Escolar — SIGEM" },
      {
        property: "og:description",
        content: "Versão para impressão do calendário escolar da rede.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { calendarioId } = Route.useParams();
  const { perfil } = Route.useSearch();
  return (
    <CalendarPrintPage
      calendarId={calendarioId}
      profile={(perfil ?? "supervisao") as CalendarProfile}
    />
  );
}
