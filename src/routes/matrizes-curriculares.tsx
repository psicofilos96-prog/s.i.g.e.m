import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/matrizes-curriculares")({
  component: MatricesLayout,
});

function MatricesLayout() {
  return <Outlet />;
}
