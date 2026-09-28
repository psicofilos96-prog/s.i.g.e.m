import { createFileRoute } from "@tanstack/react-router";
import { AssessmentEntryFieldPage } from "@/features/assessment/assessment-entry-field-page";

export const Route = createFileRoute("/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId")({
  head: () => ({
    meta: [
      { title: "Pauta de lançamento — SIGEM" },
      { name: "description", content: "Lançamento, conferência, registro e correção dos resultados de um instrumento avaliativo." },
      { property: "og:title", content: "Pauta de lançamento — SIGEM" },
      { property: "og:description", content: "Lançamento, conferência, registro e correção dos resultados de um instrumento avaliativo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { turmaId, instrumentoId } = Route.useParams();
  return <AssessmentEntryFieldPage classId={turmaId} instrumentId={instrumentoId} search={Route.useSearch()} />;
}
