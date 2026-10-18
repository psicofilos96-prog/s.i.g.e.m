import { createFileRoute, redirect } from "@tanstack/react-router";

// Um cadastro só: a chamada rápida antiga leva à chamada oficial do Diário.
export const Route = createFileRoute("/chamada")({
  beforeLoad: () => { throw redirect({ to: "/diario/chamadas", replace: true }); },
});
