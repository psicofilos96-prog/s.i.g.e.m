import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { PostingMovementPage } from "@/features/professionals/posting-movement-page";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId/lotacoes/movimentar")({
  head: () => ({
    meta: [
      { title: `Movimentação funcional — ${brand.name}` },
      {
        name: "description",
        content:
          "Fluxo demonstrativo que encerra uma lotação e cria outra em continuidade, preservando o histórico.",
      },
      { property: "og:title", content: `Movimentação funcional — ${brand.name}` },
      {
        property: "og:description",
        content: "Comparação DE / PARA com data efetiva e atomicidade conceitual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MovementRoute,
});

function MovementRoute() {
  const { id, vinculoId } = Route.useParams();
  return <PostingMovementPage professionalId={id} linkId={vinculoId} />;
}
