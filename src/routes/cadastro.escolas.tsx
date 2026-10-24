import { createFileRoute, redirect } from "@tanstack/react-router";

// O cadastro oficial preserva histórico e verifica a competência da conta.
export const Route = createFileRoute("/cadastro/escolas")({
  beforeLoad: () => { throw redirect({ to: "/unidades", replace: true }); },
});
