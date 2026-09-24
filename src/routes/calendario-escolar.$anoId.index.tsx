import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SchoolCalendarPage } from "@/features/calendar/school-calendar-page";

export const Route = createFileRoute("/calendario-escolar/$anoId/")({
  validateSearch: z.object({
    estrutura: z.string().optional(),
    perfil: z.string().optional(),
    dia: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Calendário escolar — SIGEM" },
      { name: "description", content: "Visão anual dos dias letivos, eventos e períodos avaliativos do ano letivo." },
      { property: "og:title", content: "Calendário escolar — SIGEM" },
      { property: "og:description", content: "Organização dos dias do ano letivo, com estado de homologação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { anoId } = Route.useParams();
  return <SchoolCalendarPage yearId={anoId} search={Route.useSearch()} />;
}
