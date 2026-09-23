import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/atuacoes-pedagogicas")({
  component: PedagogicalGeneralLayout,
});

function PedagogicalGeneralLayout() {
  return <Outlet />;
}
