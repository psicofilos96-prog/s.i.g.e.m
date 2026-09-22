import { createFileRoute } from "@tanstack/react-router";
import { UnitDetailPage } from "@/features/units/unit-detail-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/unidades/$id")({
  head: () => ({
    meta: [
      { title: `Visão geral institucional — ${brand.name}` },
      {
        name: "description",
        content: "Contexto institucional fictício de uma unidade educacional no SIGEM.",
      },
      { property: "og:title", content: `Unidade escolar — ${brand.name}` },
      {
        property: "og:description",
        content: "Visão geral institucional com dados fictícios e histórico preservado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnitDetailRoute,
});

function UnitDetailRoute() {
  const { id } = Route.useParams();
  return <UnitDetailPage id={id} />;
}
