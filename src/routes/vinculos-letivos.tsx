import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/vinculos-letivos")({
  component: AcademicLinksLayout,
});

function AcademicLinksLayout() {
  return <Outlet />;
}
