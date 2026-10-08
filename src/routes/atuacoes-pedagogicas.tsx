import { DemoOnlyRoute } from "@/features/classes/demo-only-route";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/atuacoes-pedagogicas")({
  component: PedagogicalGeneralLayout,
});

function PedagogicalGeneralLayout() {
  return <DemoOnlyRoute what="As atuações pedagógicas desta tela são fictícias." real="/administracao" realLabel="Abrir pessoas e atuações da rede">{() => <Outlet />}</DemoOnlyRoute>;
}
