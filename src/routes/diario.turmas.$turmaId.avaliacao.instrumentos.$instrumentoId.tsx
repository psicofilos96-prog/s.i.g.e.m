import { createFileRoute } from "@tanstack/react-router";
import { InstrumentPage } from "@/features/assessment/assessment-instrument-pages";
export const Route = createFileRoute(
  "/diario/turmas/$turmaId/avaliacao/instrumentos/$instrumentoId",
)({
  head: () => ({
    meta: [
      { title: "Lançamentos do instrumento — SIGEM" },
      {
        name: "description",
        content: "Pauta de lançamentos individuais dos alunos elegíveis na data de aplicação.",
      },
      { property: "og:title", content: "Lançamentos do instrumento — SIGEM" },
      {
        property: "og:description",
        content: "Pauta de lançamentos individuais dos alunos elegíveis na data de aplicação.",
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
