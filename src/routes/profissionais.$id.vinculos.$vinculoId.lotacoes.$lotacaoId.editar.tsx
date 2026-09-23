import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { PostingWorkspacePage } from "@/features/professionals/posting-workspace-page";

export const Route = createFileRoute(
  "/profissionais/$id/vinculos/$vinculoId/lotacoes/$lotacaoId/editar",
)({
  head: () => ({
    meta: [
      { title: `Editar lotação — ${brand.name}` },
      {
        name: "description",
        content: "Correções administrativas de lotação sem destruir o histórico.",
      },
      { property: "og:title", content: `Editar lotação — ${brand.name}` },
      {
        property: "og:description",
        content: "Mudança de unidade que represente movimentação usa o fluxo específico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditPostingRoute,
});

function EditPostingRoute() {
  const { id, vinculoId, lotacaoId } = Route.useParams();
  return (
    <PostingWorkspacePage
      mode="edicao"
      professionalId={id}
      linkId={vinculoId}
      postingId={lotacaoId}
    />
  );
}
