import { createFileRoute } from "@tanstack/react-router";
import { InstitutionalAdminPage } from "@/features/institutional-admin/institutional-admin-page";

export const Route = createFileRoute("/administracao")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administração institucional — SIGEM" },
      { name: "description", content: "Gerencie pessoas, contas, vínculos de trabalho e autorizações do SIGEM." },
      { property: "og:title", content: "Administração institucional — SIGEM" },
      { property: "og:description", content: "A conta identifica quem acessa. As autorizações dependem do vínculo ativo, da função exercida e das regras institucionais aprovadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { retorno?: string } => (typeof s["retorno"] === "string" ? { retorno: s["retorno"] } : {}),
  component: InstitutionalAdminPage,
});
