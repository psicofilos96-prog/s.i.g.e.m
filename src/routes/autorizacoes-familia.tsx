import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { GuardianAdminPage } from "@/features/family-portal/guardian-admin-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/autorizacoes-familia")({
  head: () => ({
    meta: [
      { title: `Autorizações de responsáveis — ${brand.name}` },
      { name: "description", content: "Equipe da escola concede, altera e revoga o acesso de responsáveis ao Portal da Família." },
      { property: "og:title", content: `Autorizações de responsáveis — ${brand.name}` },
      { property: "og:description", content: "Gestão registrada e auditável do acesso de responsáveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <GuardianAdminPage />}
      laboratory={() => <EmptyState title="Entre para gerir autorizações" description="A gestão de responsáveis só funciona com sua conta. Não há modo de demonstração." />}
    />
  ),
});
