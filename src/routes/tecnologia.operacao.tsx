import { createFileRoute } from "@tanstack/react-router";
import { OperationsConsole } from "@/components/sigem/operations-console";
import { TECH_STAGES } from "@/features/technology/tech-operations";
import { brand } from "@/config/branding";

const title = `Central de Tecnologia — ${brand.name}`;
const description = "Registre e acompanhe chamados, prazos de atendimento, equipamentos, conexões, serviços, acessos, incidentes, cópias de segurança, recursos pedagógicos e licenças.";

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
    <OperationsConsole ns="op-tec" eyebrow="SIGEM Tecnologia" title="Central de Tecnologia" stages={TECH_STAGES}
      description="Cada aba mostra os registros que sua conta pode consultar e as ações disponíveis. Antes de salvar, o sistema confere sua autorização, a etapa correta, quem registrou e se a aprovação necessária foi feita." />
  );
}
