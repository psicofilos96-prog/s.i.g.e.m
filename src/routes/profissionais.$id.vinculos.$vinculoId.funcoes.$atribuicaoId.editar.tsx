import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { AssignmentWorkspacePage } from "@/features/professionals/assignment-workspace-page";

export const Route = createFileRoute(
  "/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId/editar",
)({
  head: () => ({
    meta: [
      { title: `Editar atribuição de função — ${brand.name}` },
      {
        name: "description",
        content: "Correções administrativas da atribuição de função sem sobrescrever o histórico.",
      },
      { property: "og:title", content: `Editar atribuição de função — ${brand.name}` },
      {
        property: "og:description",
        content: "Alteração que represente nova designação usa encerramento e nova atribuição.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditAssignmentRoute,
});

function EditAssignmentRoute() {
  const { id, vinculoId, atribuicaoId } = Route.useParams();
  return (
    <AssignmentWorkspacePage
      mode="edicao"
      professionalId={id}
      linkId={vinculoId}
      assignmentId={atribuicaoId}
    />
  );
}
