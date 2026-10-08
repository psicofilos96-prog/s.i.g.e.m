import { DemoOnlyRoute } from "@/features/classes/demo-only-route";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/alunos")({
  component: StudentsLayout,
});

function StudentsLayout() {
  return <DemoOnlyRoute what="A consulta e o cadastro de alunos desta tela usam alunos fictícios." real="/administracao" realLabel="Abrir o cadastro de estudantes da rede">{() => <Outlet />}</DemoOnlyRoute>;
}
