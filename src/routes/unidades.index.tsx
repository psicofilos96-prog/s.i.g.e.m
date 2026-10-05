import { createFileRoute } from "@tanstack/react-router";
import { UnitsListPage } from "@/features/units/units-list-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/unidades/")({
  head: () => ({
    meta: [
      { title: `Unidades escolares — ${brand.name}` },
      {
        name: "description",
        content: "Consulta oficial do cadastro institucional das unidades escolares da rede no SIGEM.",
      },
      { property: "og:title", content: `Unidades escolares — ${brand.name}` },
      {
        property: "og:description",
        content: "Unidades escolares da rede com versão cadastral vigente, INEP e classificação administrativa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnitsListPage,
});
