import { createFileRoute } from "@tanstack/react-router";
import { MatrixWorkspacePage } from "@/features/curriculum/matrix-workspace-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/matrizes-curriculares/rascunho/$id")({
  head: () => ({
    meta: [
      { title: `Rascunho de matriz curricular — ${brand.name}` },
      {
        name: "description",
        content:
          "Edição demonstrativa de rascunho de matriz curricular em workspace dedicado, sem persistência.",
      },
      { property: "og:title", content: `Rascunho de matriz curricular — ${brand.name}` },
      {
        property: "og:description",
        content: "Rascunho em elaboração; versões históricas permanecem somente consulta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DraftRoute,
});

function DraftRoute() {
  const { id } = Route.useParams();
  return <MatrixWorkspacePage mode="rascunho" originId={id} />;
}
