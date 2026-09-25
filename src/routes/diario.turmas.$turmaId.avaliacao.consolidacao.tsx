import { createFileRoute } from "@tanstack/react-router";
import { CycleConsolidationPage } from "@/features/assessment/cycle-consolidation-pages";

const description =
  "Consolidação do ciclo avaliativo a partir das versões vigentes dos fechamentos oficiais dos períodos, com recuperação final em camada própria.";

export const Route = createFileRoute("/diario/turmas/$turmaId/avaliacao/consolidacao")({
  head: () => ({
    meta: [
      { title: "Consolidação do ciclo avaliativo — SIGEM" },
      { name: "description", content: description },
      { property: "og:title", content: "Consolidação do ciclo avaliativo — SIGEM" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { turmaId } = Route.useParams();
  return <CycleConsolidationPage classId={turmaId} search={Route.useSearch()} />;
}
