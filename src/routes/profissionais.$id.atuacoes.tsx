import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profissionais/$id/atuacoes")({
  component: PedagogicalContextLayout,
});

function PedagogicalContextLayout() {
  return <Outlet />;
}
