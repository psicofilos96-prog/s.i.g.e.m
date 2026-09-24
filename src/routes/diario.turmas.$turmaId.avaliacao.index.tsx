import { createFileRoute } from "@tanstack/react-router";
import { AssessmentStructurePage } from "@/features/assessment/assessment-structure-page";
export const Route = createFileRoute("/diario/turmas/$turmaId/avaliacao/")({
  head: () => ({
    meta: [
      { title: "Estrutura avaliativa da turma — SIGEM" },
      {
        name: "description",
        content:
          "Ano letivo, períodos avaliativos, modelo de acompanhamento e pendências normativas.",
      },
      { property: "og:title", content: "Estrutura avaliativa da turma — SIGEM" },
      {
        property: "og:description",
        content: "O que está configurado e o que ainda depende de homologação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { turmaId } = Route.useParams();
  return <AssessmentStructurePage classId={turmaId} search={Route.useSearch()} />;
}
