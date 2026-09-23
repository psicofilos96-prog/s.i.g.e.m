import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { AssignmentDetailPage } from "@/features/professionals/assignment-detail-page";

export const Route = createFileRoute(
  "/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId/",
)({
  head: () => ({
    meta: [
      { title: `Atribuição de função — ${brand.name}` },
      {
        name: "description",
        content:
          "Consulta demonstrativa de uma atribuição de função com contexto institucional e vigência.",
      },
      { property: "og:title", content: `Atribuição de função — ${brand.name}` },
      {
        property: "og:description",
        content: "A atribuição não altera cargo ou lotação e não cria atuação pedagógica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssignmentDetailRoute,
});

function AssignmentDetailRoute() {
  const { id, vinculoId, atribuicaoId } = Route.useParams();
  return (
    <AssignmentDetailPage professionalId={id} linkId={vinculoId} assignmentId={atribuicaoId} />
  );
}
