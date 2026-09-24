import { createFileRoute } from "@tanstack/react-router";
import { AssessmentRuleComparePage } from "@/features/assessment/assessment-rule-pages";

export const Route = createFileRoute("/regras-avaliativas/$regraId/comparar")({
  head: () => ({
    meta: [
      { title: "Comparar versões da regra avaliativa — SIGEM" },
      {
        name: "description",
        content:
          "Diferenças estruturais entre versões da regra avaliativa, identificadas por identificador e não por nome.",
      },
      { property: "og:title", content: "Comparar versões da regra avaliativa — SIGEM" },
      {
        property: "og:description",
        content: "Histórico preservado: cada versão permanece consultável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { regraId } = Route.useParams();
  const { perfil } = Route.useSearch();
  return <AssessmentRuleComparePage ruleId={regraId} profile={perfil} />;
}
