import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/transferencias")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/+$/, "") === "/transferencias") {
      throw redirect({ to: "/transferencias/nova", replace: true });
    }
  },
  component: () => <Outlet />,
});
