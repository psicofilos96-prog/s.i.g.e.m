import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profissionais/$id/atuacoes/$atuacaoId")({
  component: PedagogicalRecordLayout,
});

function PedagogicalRecordLayout() {
  return <Outlet />;
}
