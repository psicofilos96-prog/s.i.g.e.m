import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId/lotacoes/$lotacaoId")({
  component: PostingContextLayout,
});

function PostingContextLayout() {
  return <Outlet />;
}
