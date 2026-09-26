import { createFileRoute } from "@tanstack/react-router";
import { AcademicProjectionPage } from "@/features/academic-projections/academic-projection-pages";

const title = "Projeção canônica do percurso — SIGEM";
const description =
  "Publicação canônica dos fatos acadêmicos oficiais congelados pelo encerramento do ciclo: resultados por dimensão, frequência, deliberações, pendências estruturadas e proveniência versionada.";

export const Route = createFileRoute("/diario/turmas/$turmaId/projecao")({
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
  return <AcademicProjectionPage classId={turmaId} search={Route.useSearch()} />;
}
