import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/avancado")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
