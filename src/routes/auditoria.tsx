import { createFileRoute } from "@tanstack/react-router";
import { AuditPage } from "@/features/audit/audit-page";

export const Route = createFileRoute("/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria e governança — SIGEM" },
      { name: "description", content: "Trilha transversal dos registros históricos do SIGEM, minimizada e filtrada pelas permissões da conta." },
      { property: "og:title", content: "Auditoria e governança — SIGEM" },
      { property: "og:description", content: "Eventos de segurança e funcionais, correlação, retroatividade e integridade, sem segredos nem dados clínicos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});
