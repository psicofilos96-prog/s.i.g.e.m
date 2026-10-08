import { DemoOnlyRoute } from "@/features/classes/demo-only-route";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/vinculos-letivos")({
  component: AcademicLinksLayout,
});

function AcademicLinksLayout() {
  return <DemoOnlyRoute what="O vínculo letivo desta tela usa alunos e turmas fictícios." real="/enturmacoes" realLabel="Abrir enturmações">{() => <Outlet />}</DemoOnlyRoute>;
}
