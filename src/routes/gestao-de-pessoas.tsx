import { createFileRoute } from "@tanstack/react-router";
import { PeopleHubPage } from "@/features/professionals/people-hub-page";

export const Route = createFileRoute("/gestao-de-pessoas")({
  head: () => ({
    meta: [
      { title: "Gestão de Pessoas — SIGEM" },
      { name: "description", content: "Quadro de pessoal, ficha funcional, lotação, cobertura docente e necessidades a partir dos registros oficiais." },
      { property: "og:title", content: "Gestão de Pessoas — SIGEM" },
      { property: "og:description", content: "Pessoal, lotação e atribuição de aulas sem dado fictício." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeopleHubPage,
});
