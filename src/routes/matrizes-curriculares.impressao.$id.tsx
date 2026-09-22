import { createFileRoute } from "@tanstack/react-router";
import { MatrixPrintPage } from "@/features/curriculum/matrix-print-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/matrizes-curriculares/impressao/$id")({
  head: () => ({
    meta: [
      { title: `Matriz curricular para impressão — ${brand.name}` },
      {
        name: "description",
        content:
          "Pré-visualização institucional da matriz curricular preparada para impressão futura.",
      },
      { property: "og:title", content: `Matriz curricular para impressão — ${brand.name}` },
      {
        property: "og:description",
        content: "Documento demonstrativo com estrutura curricular legível em formato institucional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrintRoute,
});

function PrintRoute() {
  const { id } = Route.useParams();
  return <MatrixPrintPage id={id} />;
}
