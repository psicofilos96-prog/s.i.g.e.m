import { createFileRoute } from "@tanstack/react-router";
import { AssessmentRuleEditorPage } from "@/features/assessment/assessment-rule-pages";

export const Route = createFileRoute("/regras-avaliativas/$regraId/editar")({
  head: () => ({
    meta: [
      { title: "Editar regra avaliativa — SIGEM" },
      {
        name: "description",
        content:
          "Identificação, estratégia, categorias, recuperações, consolidação anual e momentos de arredondamento.",
      },
      { property: "og:title", content: "Editar regra avaliativa — SIGEM" },
      {
        property: "og:description",
        content: "Edição exclusiva da Supervisão de Ensino, apenas em rascunho.",
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
  return <AssessmentRuleEditorPage ruleId={regraId} profile={perfil} />;
}
