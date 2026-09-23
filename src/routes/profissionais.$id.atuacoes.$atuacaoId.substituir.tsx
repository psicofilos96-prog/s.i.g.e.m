import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { PedagogicalSubstitutionPage } from "@/features/pedagogical/pedagogical-substitution-page";

export const Route = createFileRoute("/profissionais/$id/atuacoes/$atuacaoId/substituir")({
  head: () => ({
    meta: [
      { title: `Substituição temporária de atuação — ${brand.name}` },
      {
        name: "description",
        content:
          "Fluxo demonstrativo de substituição temporária com titular, substituto, vínculos, intervalo, papel e contexto acadêmico.",
      },
      { property: "og:title", content: `Substituição temporária de atuação — ${brand.name}` },
      {
        property: "og:description",
        content:
          "A atuação original permanece preservada e a substituição cria uma relação temporal própria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubstitutionRoute,
});

function SubstitutionRoute() {
  const { id, atuacaoId } = Route.useParams();
  return <PedagogicalSubstitutionPage professionalId={id} activityId={atuacaoId} />;
}
