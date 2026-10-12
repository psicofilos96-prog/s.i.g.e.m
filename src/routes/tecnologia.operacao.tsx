import { createFileRoute } from "@tanstack/react-router";
import { OperationsConsole } from "@/components/sigem/operations-console";
import { TECH_STAGES } from "@/features/technology/tech-operations";
import { brand } from "@/config/branding";

const title = `Central operacional de tecnologia — ${brand.name}`;
const description = "Chamados, fila, SLA, sessões, mudanças, inventário, conectividade, serviços, acessos, incidentes, backup, conhecimento, recursos pedagógicos e licenças pelos writers do banco.";

export const Route = createFileRoute("/tecnologia/operacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TechOperationsPage,
});

function TechOperationsPage() {
  return (
    <OperationsConsole ns="op-tec" eyebrow="SIGEM Tecnologia" title="Central operacional de tecnologia" stages={TECH_STAGES}
      description="Cada aba mostra os registros que sua conta pode ver e as ações da etapa. Toda gravação passa pelo writer do banco, que confere permissão, sequência, autoria e aprovação por outra pessoa." />
  );
}
