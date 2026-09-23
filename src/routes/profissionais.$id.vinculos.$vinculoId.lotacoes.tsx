import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId/lotacoes")({
  component: PostingsLayout,
});

function PostingsLayout() {
  return <Outlet />;
}
