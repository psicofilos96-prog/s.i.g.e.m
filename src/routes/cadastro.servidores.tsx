import { createFileRoute, redirect } from "@tanstack/react-router";

// Um cadastro só (decisão do proprietário, 2026-10-15): o cadastro rápido leva ao oficial.
// Os dados das planilhas continuam guardados e aparecem nas buscas do cadastro oficial.
export const Route = createFileRoute("/cadastro/servidores")({
  beforeLoad: () => { throw redirect({ to: "/profissionais", replace: true }); },
});
