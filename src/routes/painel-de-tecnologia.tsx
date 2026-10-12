import { createFileRoute } from "@tanstack/react-router";
import { TechDashboardPage } from "@/features/technology/tech-dashboard-page";

export const Route = createFileRoute("/painel-de-tecnologia")({
  head: () => ({
    meta: [
      { title: "Painel de Tecnologia — chamados, incidentes e mudanças" },
      { name: "description", content: "Painel operacional de tecnologia educacional com chamados, incidentes, problemas e mudanças da rede." },
      { property: "og:title", content: "SIGEM Tecnologia — painel operacional" },
      { property: "og:description", content: "Indicadores de suporte técnico calculados dos registros oficiais, com acesso restrito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechDashboardPage,
});
