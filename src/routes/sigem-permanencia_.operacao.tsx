import { createFileRoute } from "@tanstack/react-router";
import { OperationsConsole } from "@/components/sigem/operations-console";
import { PERMANENCE_STAGES } from "@/features/permanence/permanence-operations.gen";
import { brand } from "@/config/branding";

const title = `Operação da Permanência — ${brand.name}`;
const description = "Regras, alertas, contatos, visitas, plano, encaminhamento e retorno pelos registros oficiais da Permanência.";

export const Route = createFileRoute("/sigem-permanencia_/operacao")({
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
    <OperationsConsole ns="op-perm" eyebrow="SIGEM Permanência" title="Operação da Permanência" stages={PERMANENCE_STAGES}
      description="Cada ação grava pelo registro oficial, que confere permissão, pessoa da sessão e regra aprovada. Nada aqui classifica evasão ou diagnóstico." />
  ),
});
