import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId")({
  component: FunctionalLinkContextLayout,
});

function FunctionalLinkContextLayout() {
  return <Outlet />;
}
