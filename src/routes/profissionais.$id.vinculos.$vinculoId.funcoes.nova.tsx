import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { AssignmentWorkspacePage } from "@/features/professionals/assignment-workspace-page";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId/funcoes/nova")({
  head: () => ({
    meta: [
      { title: `Nova atribuição de função — ${brand.name}` },
      {
        name: "description",
        content:
          "Workspace demonstrativo para registrar atribuição de função a partir de um vínculo funcional existente.",
      },
      { property: "og:title", content: `Nova atribuição de função — ${brand.name}` },
      {
        property: "og:description",
        content: "Função, contexto, lotação relacionada, vigência e carga contextual opcional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewAssignmentRoute,
});

function NewAssignmentRoute() {
  const { id, vinculoId } = Route.useParams();
  return <AssignmentWorkspacePage mode="nova" professionalId={id} linkId={vinculoId} />;
}
