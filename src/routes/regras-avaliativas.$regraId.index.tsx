import { createFileRoute } from "@tanstack/react-router";
import { AssessmentRuleDetailPage } from "@/features/assessment/assessment-rule-pages";

export const Route = createFileRoute("/regras-avaliativas/$regraId/")({
  head: () => ({
    meta: [
      { title: "Regra avaliativa — prévia e situação normativa — SIGEM" },
      {
        name: "description",
        content:
          "Prévia da regra em linguagem natural, validação, auditoria demonstrativa e simulador da Supervisão.",
      },
      { property: "og:title", content: "Regra avaliativa — prévia e situação normativa — SIGEM" },
      {
        property: "og:description",
        content: "Somente regra homologada alimenta o cálculo institucional.",
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
  return <AssessmentRuleDetailPage ruleId={regraId} profile={perfil} />;
}
