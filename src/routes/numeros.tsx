import { createFileRoute, redirect } from "@tanstack/react-router";

// Um cadastro só: contagens rápidas saem do gerador oficial, lido com o acesso da conta.
export const Route = createFileRoute("/numeros")({
  beforeLoad: () => { throw redirect({ to: "/relatorios/personalizado", replace: true }); },
});
