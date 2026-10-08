import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { CardAdminPage } from "@/features/family-portal/card-admin-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/carteirinhas")({
  head: () => ({
    meta: [
      { title: `Carteirinhas do estudante — ${brand.name}` },
      { name: "description", content: "Secretaria emite, reemite e cancela carteirinhas com QR de verificação e histórico." },
      { property: "og:title", content: `Carteirinhas do estudante — ${brand.name}` },
      { property: "og:description", content: "Emissão registrada e auditável da carteirinha do estudante." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <CardAdminPage />}
      laboratory={() => <EmptyState title="Entre para gerir carteirinhas" description="A emissão de carteirinhas só funciona com sua conta. Não há modo de demonstração." />}
    />
  ),
});
