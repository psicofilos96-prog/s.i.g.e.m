import { createFileRoute } from "@tanstack/react-router";
import { InstitutionalAdminPage } from "@/features/institutional-admin/institutional-admin-page";

export const Route = createFileRoute("/administracao")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administração institucional — SIGEM" },
      { name: "description", content: "Instalação única, pessoas, contas, atuações e Política de Capacidades do SIGEM." },
      { property: "og:title", content: "Administração institucional — SIGEM" },
      { property: "og:description", content: "Conta identifica; capacidade vem da atuação vigente e da política homologada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { retorno?: string } => (typeof s["retorno"] === "string" ? { retorno: s["retorno"] } : {}),
  component: InstitutionalAdminPage,
});
