import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { ImportCenterPage } from "@/features/data-import/import-center-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/importacoes")({
  validateSearch: (s: Record<string, unknown>): { adaptador?: string } => (typeof s['adaptador'] === "string" && /^[a-z0-9-]{1,80}$/.test(s['adaptador']) ? { adaptador: s['adaptador'] } : {}),
  head: () => ({
    meta: [
      { title: `Central de importações — ${brand.name}` },
      { name: "description", content: "Receba arquivos externos, confira prévia, conflitos e erros, e confirme a aplicação pelo cadastro oficial." },
      { property: "og:title", content: `Central de importações — ${brand.name}` },
      { property: "og:description", content: "Importações conferidas e reconciliadas antes de virar registro oficial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: function ImportRoute() { const { adaptador } = Route.useSearch(); return (
    <ClassRouteGate
      institutional={() => <ImportCenterPage initialAdapter={adaptador} />}
      laboratory={() => <EmptyState title="Entre para importar" description="Importações só existem com sessão institucional. Não há modo de demonstração." />}
    />
  ); },
});
