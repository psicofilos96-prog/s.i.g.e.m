import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId/funcoes")({
  component: AssignmentsLayout,
});

function AssignmentsLayout() {
  return <Outlet />;
}
