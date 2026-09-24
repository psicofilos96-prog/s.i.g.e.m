import { Outlet, createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/diario/turmas/$turmaId/alunos/$alunoId")({
  component: () => <Outlet />,
});
