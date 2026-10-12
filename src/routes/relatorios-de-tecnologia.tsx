import { createFileRoute } from "@tanstack/react-router";
import { TechReportsPage } from "@/features/technology/tech-reports-page";

export const Route = createFileRoute("/relatorios-de-tecnologia")({
  head: () => ({
    meta: [
      { title: "Relatórios de Tecnologia — SIGEM" },
      { name: "description", content: "Catálogo de 22 relatórios de tecnologia educacional com fonte, metodologia e filtros, e ficha do chamado." },
      { property: "og:title", content: "SIGEM Tecnologia — relatórios" },
      { property: "og:description", content: "Relatórios calculados dos registros oficiais, com acesso restrito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechReportsPage,
});
