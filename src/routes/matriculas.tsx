import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/matriculas")({
  component: EnrollmentsLayout,
});

function EnrollmentsLayout() {
  return <Outlet />;
}
