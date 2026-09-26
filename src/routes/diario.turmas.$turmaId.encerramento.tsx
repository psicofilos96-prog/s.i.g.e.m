import { createFileRoute } from "@tanstack/react-router";
import { CycleClosingPage } from "@/features/cycle-closing/cycle-closing-pages";

const title = "Encerramento do ciclo e da turma — SIGEM";
const description =
  "Conferência da cadeia acadêmica e ato de encerramento oficial do ciclo e da turma: cada exigência configurada aparece com o seu estado por extenso, e o registro é versionado e imutável.";

export const Route = createFileRoute("/diario/turmas/$turmaId/encerramento")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { turmaId } = Route.useParams();
  return <CycleClosingPage classId={turmaId} search={Route.useSearch()} />;
}
