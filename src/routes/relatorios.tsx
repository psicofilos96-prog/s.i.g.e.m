import { createFileRoute } from "@tanstack/react-router";
import { ReportsCatalogPage } from "@/features/reports/reports-catalog-page";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — SIGEM" },
      { name: "description", content: "Catálogo único de relatórios do SIGEM com fonte, versão, formatos e dependências declaradas." },
      { property: "og:title", content: "Relatórios — SIGEM" },
      { property: "og:description", content: "Relatórios com definição versionada; exportar nunca amplia o acesso da conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsCatalogPage,
});
