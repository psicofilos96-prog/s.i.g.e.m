import { createFileRoute } from "@tanstack/react-router";
import { AssessmentEntryFieldPage } from "@/features/assessment/assessment-entry-field-page";

export const Route = createFileRoute("/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId")({
  head: () => ({
    meta: [
      { title: "Pauta de lançamento 2.0 — SIGEM" },
      { name: "description", content: "Laboratório de campo da pauta de lançamento, conferência, registro e correção focal." },
      { property: "og:title", content: "Pauta de lançamento 2.0 — SIGEM" },
      { property: "og:description", content: "Laboratório de campo da pauta de lançamento, conferência, registro e correção focal." },
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
