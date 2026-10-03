import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CalendarListRoute } from "@/features/calendar/institutional-calendar-routes";

/** B4.6.2a — fronteira de sessão: com sessão só consulta institucional; sem sessão, laboratório. */
export const Route = createFileRoute("/calendario-escolar/")({
  validateSearch: z.object({ perfil: z.enum(["supervisao", "escola", "professor"]).optional() }),
  head: () => ({
    meta: [
      { title: "Calendários escolares — SIGEM" },
      { name: "description", content: "Consulta aos calendários escolares do SIGEM." },
      { property: "og:title", content: "Calendários escolares — SIGEM" },
      { property: "og:description", content: "Consulta aos calendários escolares do SIGEM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { perfil } = Route.useSearch();
  return <CalendarListRoute perfil={perfil} />;
}
