import { createFileRoute } from "@tanstack/react-router";
import { MatricesListPage } from "@/features/curriculum/matrices-list-page";
import { brand } from "@/config/branding";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { InstitutionalMatricesList } from "@/features/curriculum/institutional-matrices";

export const Route = createFileRoute("/matrizes-curriculares/")({
  head: () => ({
    meta: [
      { title: `Matrizes curriculares — ${brand.name}` },
      {
        name: "description",
        content:
          "Consulta demonstrativa de matrizes curriculares versionadas, com organização acadêmica e vigência.",
      },
      { property: "og:title", content: `Matrizes curriculares — ${brand.name}` },
      {
        property: "og:description",
        content: "Matrizes versionadas por segmento, com vigência e situação demonstrativas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClassRouteGate institutional={() => <InstitutionalMatricesList />} laboratory={() => <MatricesListPage />} />,
});
