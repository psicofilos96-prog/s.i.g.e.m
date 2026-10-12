import { createFileRoute } from "@tanstack/react-router";
import { DocumentsHubPage } from "@/features/document-management/documents-hub-page";

export const Route = createFileRoute("/sigem-documentos")({
  head: () => ({
    meta: [
      { title: "SIGEM Documentos — protocolo e processos" },
      { name: "description", content: "Caixa de entrada por unidade, pesquisa de processos, relatórios documentais e matriz de fechamento." },
      { property: "og:title", content: "SIGEM Documentos — protocolo e processos" },
      { property: "og:description", content: "Protocolo, processos e tramitação com evidências e bloqueios declarados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsHubPage,
});
