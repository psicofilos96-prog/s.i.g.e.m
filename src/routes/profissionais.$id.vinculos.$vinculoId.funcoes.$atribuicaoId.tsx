import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId",
)({
  component: AssignmentContextLayout,
});

function AssignmentContextLayout() {
  return <Outlet />;
}
