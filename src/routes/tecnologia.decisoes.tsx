import { createFileRoute } from "@tanstack/react-router";
import { OperationsConsole } from "@/components/sigem/operations-console";
import { TECH_DECISION_STAGES } from "@/features/technology/tech-decisions";
import { brand } from "@/config/branding";

const title = `Decisões institucionais de tecnologia — ${brand.name}`;
const description = "Sete regras pendentes de Tecnologia em versões propostas e aprovadas por outra pessoa, sem homologação automática.";

export const Route = createFileRoute("/tecnologia/decisoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TechDecisionsPage,
});

function TechDecisionsPage() {
  return (
    <OperationsConsole ns="dec-tec" eyebrow="SIGEM Tecnologia" title="Decisões institucionais de tecnologia" stages={TECH_DECISION_STAGES}
      description="Cada aba é uma regra que hoje bloqueia relatórios. Propor cria nova versão com fonte; só vale depois de aprovada por outra pessoa com competência. Nada aqui é aprovado automaticamente." />
  );
}
