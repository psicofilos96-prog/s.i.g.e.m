import { createFileRoute } from "@tanstack/react-router";
import { NewInstrumentPage } from "@/features/assessment/assessment-instrument-pages";
export const Route = createFileRoute("/diario/turmas/$turmaId/avaliacao/instrumentos/novo")({
  head: () => ({
    meta: [
      { title: "Novo instrumento avaliativo — SIGEM" },
      {
        name: "description",
        content: "Cadastro de instrumento no período derivado da data de aplicação.",
      },
      { property: "og:title", content: "Novo instrumento avaliativo — SIGEM" },
      {
        property: "og:description",
        content: "Cadastro de instrumento no período derivado da data de aplicação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { turmaId } = Route.useParams();
  return <NewInstrumentPage classId={turmaId} search={Route.useSearch()} />;
}
