import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CalendarListPage, type CalendarProfile } from "@/features/calendar/calendar-pages";

export const Route = createFileRoute("/calendario-escolar/")({
  validateSearch: z.object({ perfil: z.enum(["supervisao", "escola", "professor"]).optional() }),
  head: () => ({
    meta: [
      { title: "Calendário escolar da rede — SIGEM" },
      { name: "description", content: "Calendários centrais da rede, elaborados e homologados pela Supervisão de Ensino." },
      { property: "og:title", content: "Calendário escolar da rede — SIGEM" },
      { property: "og:description", content: "Um calendário por ano letivo e modalidade; escolas apenas consultam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { perfil } = Route.useSearch();
  return <CalendarListPage profile={(perfil ?? "supervisao") as CalendarProfile} />;
}
