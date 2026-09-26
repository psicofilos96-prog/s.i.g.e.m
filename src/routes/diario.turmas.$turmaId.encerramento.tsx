import { createFileRoute } from "@tanstack/react-router";
import { CycleClosingPage } from "@/features/cycle-closing/cycle-closing-pages";
import { diarySearchSchema } from "@/features/diary/diary-data";

export const Route = createFileRoute("/diario/turmas/$turmaId/encerramento")({
  validateSearch: diarySearchSchema,
  head: () => ({
    meta: [
      { title: "Encerramento do ciclo e da turma · SIGEM" },
      {
        name: "description",
        content:
          "Conferência da cadeia acadêmica e ato de encerramento oficial do ciclo e da turma, com requisitos configurados e registro versionado.",
      },
      { property: "og:title", content: "Encerramento do ciclo e da turma · SIGEM" },
      {
        property: "og:description",
        content:
          "Cada exigência configurada é exibida com o seu estado por extenso; o encerramento só avança com a cadeia íntegra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { turmaId } = Route.useParams();
  const search = Route.useSearch();
  return <CycleClosingPage classId={turmaId} search={search} />;
}
