import { createFileRoute } from "@tanstack/react-router";
import { InstrumentPage } from "@/features/assessment/assessment-instrument-pages";
export const Route = createFileRoute(
  "/diario/turmas/$turmaId/avaliacao/instrumentos/$instrumentoId",
)({
  head: () => ({
    meta: [
      { title: "Instrumento avaliativo — SIGEM" },
      {
        name: "description",
        content: "Dados do instrumento avaliativo e acesso à pauta de lançamento.",
      },
      { property: "og:title", content: "Instrumento avaliativo — SIGEM" },
      {
        property: "og:description",
        content: "Dados do instrumento avaliativo e acesso à pauta de lançamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { turmaId, instrumentoId } = Route.useParams();
  return (
    <InstrumentPage classId={turmaId} instrumentId={instrumentoId} search={Route.useSearch()} />
  );
}
