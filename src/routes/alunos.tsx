import { DemoOnlyRoute } from "@/features/classes/demo-only-route";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/alunos")({
  component: StudentsLayout,
});

function StudentsLayout() {
  // Lista e ficha já leem os dados reais; só cadastro/edição continuam de demonstração.
  const path = useRouterState({ select: (r) => r.location.pathname });
  if (/^\/alunos\/?$/.test(path) || (/^\/alunos\/[^/]+\/?$/.test(path) && !/\/novo\/?$/.test(path))) return <Outlet />;
  return <DemoOnlyRoute what="A consulta e o cadastro de alunos desta tela usam alunos fictícios." real="/administracao" realLabel="Abrir o cadastro de estudantes da rede">{() => <Outlet />}</DemoOnlyRoute>;
}
