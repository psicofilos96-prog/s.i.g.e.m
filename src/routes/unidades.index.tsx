import { createFileRoute } from "@tanstack/react-router";
import { UnitsListPage } from "@/features/units/units-list-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/unidades/")({
  head: () => ({
    meta: [
      { title: `Unidades escolares — ${brand.name}` },
      { name: "description", content: "Consulta demonstrativa de unidades escolares no SIGEM." },
      { property: "og:title", content: `Unidades escolares — ${brand.name}` },
      {
        property: "og:description",
        content: "Experiência operacional demonstrativa para consulta de unidades escolares.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnitsListPage,
});
