import { DemoOnlyRoute } from "@/features/classes/demo-only-route";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/profissionais")({ component: ProfessionalsLayout });
function ProfessionalsLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  if (/^\/profissionais\/?$/.test(path)) return <Outlet />;
  return <DemoOnlyRoute what="A consulta de profissionais desta tela usa profissionais fictícios." real="/departamento-pessoal" realLabel="Abrir a vida funcional (DP)">{() => <Outlet />}</DemoOnlyRoute>;
}
