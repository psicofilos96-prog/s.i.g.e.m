import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/turmas")({
  component: ClassesLayout,
});

function ClassesLayout() {
  return <Outlet />;
}
