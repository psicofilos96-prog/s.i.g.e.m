import { Outlet, createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/horarios/profissionais/$profissionalId")({
  component: () => <Outlet />,
});
