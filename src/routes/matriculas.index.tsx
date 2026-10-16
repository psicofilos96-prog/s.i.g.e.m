import { createFileRoute, redirect } from "@tanstack/react-router";

/** "/matriculas" não tem conteúdo próprio: abre direto a matrícula guiada. */
export const Route = createFileRoute("/matriculas/")({
  beforeLoad: () => { throw redirect({ to: "/matriculas/nova", replace: true }); },
});
