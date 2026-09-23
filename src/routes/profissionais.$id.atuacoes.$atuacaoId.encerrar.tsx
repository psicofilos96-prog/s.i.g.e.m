import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { PedagogicalClosePage } from "@/features/pedagogical/pedagogical-close-page";

export const Route = createFileRoute("/profissionais/$id/atuacoes/$atuacaoId/encerrar")({
  head: () => ({
    meta: [
      { title: `Encerrar atuação pedagógica — ${brand.name}` },
      {
        name: "description",
        content:
          "Encerramento demonstrativo de atuação pedagógica com término proposto, consequências preservadas e revisão.",
      },
      { property: "og:title", content: `Encerrar atuação pedagógica — ${brand.name}` },
      {
        property: "og:description",
        content: "Encerrar a atuação não encerra vínculo, lotação, função, profissional ou pessoa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClosePedagogicalRoute,
});

function ClosePedagogicalRoute() {
  const { id, atuacaoId } = Route.useParams();
  return <PedagogicalClosePage professionalId={id} activityId={atuacaoId} />;
}
