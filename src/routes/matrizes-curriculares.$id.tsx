import { createFileRoute } from "@tanstack/react-router";
import { MatrixDetailPage } from "@/features/curriculum/matrix-detail-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/matrizes-curriculares/$id")({
  head: () => ({
    meta: [
      { title: `Matriz curricular — ${brand.name}` },
      {
        name: "description",
        content:
          "Estrutura, versão, vigência e aplicação demonstrativa de uma matriz curricular no SIGEM.",
      },
      { property: "og:title", content: `Matriz curricular — ${brand.name}` },
      {
        property: "og:description",
        content: "Matriz versionada com estrutura curricular e histórico preservado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatrixDetailRoute,
});

function MatrixDetailRoute() {
  const { id } = Route.useParams();
  return <MatrixDetailPage id={id} />;
}
