import { createFileRoute } from "@tanstack/react-router";
import { SupportPage } from "@/features/support/support-page";

export const Route = createFileRoute("/diagnostico")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Diagnóstico e suporte — SIGEM" },
      { name: "description", content: "Estado técnico do SIGEM para a Administração Geral: ambiente, migrations, dependências e falhas sanitizadas." },
      { property: "og:title", content: "Diagnóstico e suporte — SIGEM" },
      { property: "og:description", content: "Painel técnico somente leitura, sem dados pessoais nem credenciais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});
