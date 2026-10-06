import { createFileRoute } from "@tanstack/react-router";
import { InstitutionalRulesAdminPage } from "@/features/institutional-rules/institutional-rules-admin";

export const Route = createFileRoute("/regras-institucionais")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Regras institucionais — SIGEM" },
      { name: "description", content: "Rascunho, pré-visualização, homologação e histórico das regras de correção, fechamento, frequência e colegiados." },
      { property: "og:title", content: "Regras institucionais — SIGEM" },
      { property: "og:description", content: "Configuração governada das regras institucionais consumidas pelos motores oficiais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstitutionalRulesAdminPage,
});
