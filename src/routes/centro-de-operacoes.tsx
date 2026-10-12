import { createFileRoute } from "@tanstack/react-router";
import { OperationsHubPage } from "@/features/operations-center/operations-hub-page";

export const Route = createFileRoute("/centro-de-operacoes")({
  head: () => ({
    meta: [
      { title: "Centro de Operações — transporte, infraestrutura e patrimônio" },
      { name: "description", content: "Painel integrado de transporte escolar, infraestrutura e manutenção, patrimônio e almoxarifado, com relatórios e fontes declaradas." },
      { property: "og:title", content: "Centro de Operações e Recursos Escolares" },
      { property: "og:description", content: "Operações escolares com fonte única, autoria real e acesso restrito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OperationsHubPage,
});
