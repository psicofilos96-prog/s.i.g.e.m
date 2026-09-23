import { Outlet, createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/horarios/unidades/$unidadeId")({
  component: () => <Outlet />,
});
