import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/enturmacoes")({
  component: AllocationsLayout,
});

function AllocationsLayout() {
  return <Outlet />;
}
