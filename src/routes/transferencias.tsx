import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/transferencias")({
  component: () => <Outlet />,
});
