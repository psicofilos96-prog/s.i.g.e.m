import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { AssignmentClosePage } from "@/features/professionals/assignment-close-page";

export const Route = createFileRoute(
  "/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId/encerrar",
)({
  head: () => ({
    meta: [
      { title: `Encerrar atribuição de função — ${brand.name}` },
      {
        name: "description",
        content:
          "Encerramento demonstrativo que define término e preserva o histórico da atribuição.",
      },
      { property: "og:title", content: `Encerrar atribuição de função — ${brand.name}` },
      {
        property: "og:description",
        content: "O encerramento não encerra vínculo ou lotação e não altera o cargo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CloseAssignmentRoute,
});

function CloseAssignmentRoute() {
  const { id, vinculoId, atribuicaoId } = Route.useParams();
  return <AssignmentClosePage professionalId={id} linkId={vinculoId} assignmentId={atribuicaoId} />;
}
