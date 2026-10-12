import { createFileRoute } from "@tanstack/react-router";
import { OperationsConsole } from "@/components/sigem/operations-console";
import { OPS_STAGES } from "@/features/operations-center/ops-operations.gen";
import { brand } from "@/config/branding";

const title = `Operação do Centro de Operações — ${brand.name}`;
const description = "Solicitações, infraestrutura, manutenção, patrimônio, almoxarifado e transporte pelos registros oficiais.";

export const Route = createFileRoute("/centro-de-operacoes_/operacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <OperationsConsole ns="op-ops" eyebrow="SIGEM Centro de Operações" title="Operação do Centro de Operações" stages={OPS_STAGES}
      description="Cada ação grava pelo registro oficial, que confere permissão, pessoa da sessão, etapa e comprovante. Evidência e custo só com documento juntado." />
  ),
});
