import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { PedagogicalWorkspacePage } from "@/features/pedagogical/pedagogical-workspace-page";

export const Route = createFileRoute("/profissionais/$id/atuacoes/$atuacaoId/editar")({
  head: () => ({
    meta: [
      { title: `Editar atuação pedagógica — ${brand.name}` },
      {
        name: "description",
        content:
          "Correções administrativas pertinentes de uma atuação pedagógica, sem sobrescrever o histórico nem trocar silenciosamente o contexto institucional.",
      },
      { property: "og:title", content: `Editar atuação pedagógica — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Quando a mudança representa nova atribuição, a orientação é encerrar e criar uma nova atuação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditPedagogicalRoute,
});

function EditPedagogicalRoute() {
  const { id, atuacaoId } = Route.useParams();
  return (
    <PedagogicalWorkspacePage mode="edicao" professionalId={id} activityId={atuacaoId} />
  );
}
