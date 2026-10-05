import { createFileRoute } from "@tanstack/react-router";
import { IntegrationPage } from "@/features/integration/integration-page";

export const Route = createFileRoute("/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações externas — SIGEM" },
      { name: "description", content: "Clientes de máquina, chaves, permissões mínimas e webhooks assinados do SIGEM." },
      { property: "og:title", content: "Integrações externas — SIGEM" },
      { property: "og:description", content: "API versionada e webhooks assinados sem acesso direto ao banco." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntegrationPage,
});
