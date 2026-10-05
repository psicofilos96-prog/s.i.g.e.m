import { createFileRoute } from "@tanstack/react-router";
import { AccessCenterPage } from "@/features/institutional-admin/access-center-page";

export const Route = createFileRoute("/central-de-acessos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Central de acessos — SIGEM" },
      { name: "description", content: "Pessoas, contas, atuações, capacidades e versões da política de acesso do SIGEM." },
      { property: "og:title", content: "Central de acessos — SIGEM" },
      { property: "og:description", content: "Administração da política de capacidades com histórico, comparação e validação antes de efetivar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessCenterPage,
});
