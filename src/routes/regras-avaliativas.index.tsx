import { createFileRoute } from "@tanstack/react-router";
import { AssessmentRuleListPage } from "@/features/assessment/assessment-rule-pages";

export const Route = createFileRoute("/regras-avaliativas/")({
  head: () => ({
    meta: [
      { title: "Regras avaliativas da rede — SIGEM" },
      {
        name: "description",
        content:
          "Configuração, revisão, homologação e histórico das regras avaliativas definidas pela Supervisão de Ensino.",
      },
      { property: "og:title", content: "Regras avaliativas da rede — SIGEM" },
      {
        property: "og:description",
        content: "Supervisão configura, revisa e homologa; escolas e professores consultam.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { perfil } = Route.useSearch();
  return <AssessmentRuleListPage profile={perfil} />;
}
