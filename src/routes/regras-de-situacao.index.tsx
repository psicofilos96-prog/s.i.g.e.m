import { createFileRoute } from "@tanstack/react-router";
import { StandingRuleBuilderListPage } from "@/features/assessment/standing-rule-builder-pages";

export const Route = createFileRoute("/regras-de-situacao/")({
  head: () => ({
    meta: [
      { title: "Regras de situação acadêmica — SIGEM" },
      {
        name: "description",
        content:
          "Cadastro institucional configurável das regras de situação acadêmica: situações, critérios, parâmetros, consequências e deliberações.",
      },
      { property: "og:title", content: "Regras de situação acadêmica — SIGEM" },
      {
        property: "og:description",
        content:
          "A governança configura, simula, revisa e homologa; o motor apenas executa primitivas declaradas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StandingRuleBuilderListPage,
});
