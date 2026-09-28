import { createFileRoute } from "@tanstack/react-router";
import { AssessmentPeriodPage } from "@/features/assessment/assessment-period-page";

export const Route = createFileRoute("/diario/turmas/$turmaId/avaliacao/periodo")({
  head: () => ({
    meta: [
      { title: "Avaliação do período — SIGEM" },
      { name: "description", content: "Mesa avaliativa: instrumentos, registros oficiais e composição do período da turma." },
      { property: "og:title", content: "Avaliação do período — SIGEM" },
      { property: "og:description", content: "Compreender, localizar e navegar pelos registros avaliativos do período." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { turmaId } = Route.useParams();
  return <AssessmentPeriodPage classId={turmaId} search={Route.useSearch()} />;
}
