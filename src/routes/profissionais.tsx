import { DemoOnlyRoute } from "@/features/classes/demo-only-route";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profissionais")({ component: ProfessionalsLayout });
function ProfessionalsLayout() {
  return <DemoOnlyRoute what="A consulta de profissionais desta tela usa profissionais fictícios." real="/departamento-pessoal" realLabel="Abrir a vida funcional (DP)">{() => <Outlet />}</DemoOnlyRoute>;
}
