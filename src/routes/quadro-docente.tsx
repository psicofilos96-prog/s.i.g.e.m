import { createFileRoute } from "@tanstack/react-router";
import { StaffingPage } from "@/features/staffing/staffing-page";

export const Route = createFileRoute("/quadro-docente")({
  head: () => ({
    meta: [
      { title: "Quadro docente — SIGEM" },
      { name: "description", content: "Aulas ofertadas, cobertura por regência e necessidade de professor derivadas da grade real, com composição auditável." },
      { property: "og:title", content: "Quadro docente — SIGEM" },
      { property: "og:description", content: "Demanda, cobertura e necessidade de professor sem regra funcional inventada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffingPage,
});
