import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { FamilyPortalPage } from "@/features/family-portal/family-portal-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/familia")({
  validateSearch: (s: Record<string, unknown>): { aluno?: string | undefined } => ({ aluno: typeof s["aluno"] === "string" ? (s["aluno"] as string) : undefined }),
  head: () => ({
    meta: [
      { title: `Portal da Família — ${brand.name}` },
      { name: "description", content: "Acompanhe a vida escolar dos educandos que você tem autorização para consultar." },
      { property: "og:title", content: `Portal da Família — ${brand.name}` },
      { property: "og:description", content: "Consulta da vida escolar com autorização vigente e dados publicados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const s = Route.useSearch();
  return (
    <ClassRouteGate
      institutional={() => <FamilyPortalPage requested={s.aluno} />}
      laboratory={() => <EmptyState title="Entre para acompanhar" description="O Portal da Família só funciona com sua conta. Não há modo de demonstração." />}
    />
  );
}
