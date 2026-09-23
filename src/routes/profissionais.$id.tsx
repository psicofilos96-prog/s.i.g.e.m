import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profissionais/$id")({
  component: ProfessionalContextLayout,
});

function ProfessionalContextLayout() {
  return <Outlet />;
}
