import { createFileRoute } from "@tanstack/react-router";
import { PeriodClosingPage } from "@/features/assessment/period-closing-pages";

const description =
  "Entrega docente, conferência institucional e fechamento oficial do período avaliativo, com versões auditadas.";

export const Route = createFileRoute("/diario/turmas/$turmaId/avaliacao/fechamento")({
  head: () => ({
    meta: [
      { title: "Fechamento do período avaliativo — SIGEM" },
      { name: "description", content: description },
      { property: "og:title", content: "Fechamento do período avaliativo — SIGEM" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { turmaId } = Route.useParams();
  return <PeriodClosingPage classId={turmaId} search={Route.useSearch()} />;
}
