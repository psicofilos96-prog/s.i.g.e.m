import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { InclusionPage } from "@/features/inclusion/inclusion-page";

export const Route = createFileRoute("/inclusao")({
  head: () => ({
    meta: [
      { title: "Inclusão — apoio educacional, AEE e mediação — SIGEM" },
      { name: "description", content: "Registros pedagógicos de inclusão com finalidade educacional, acesso restrito e histórico, sem prontuário clínico." },
      { property: "og:title", content: "Inclusão — SIGEM" },
      { property: "og:description", content: "Necessidade de apoio, AEE e mediação como registros pedagógicos versionados e protegidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <InclusionPage />} laboratory={() => <EmptyState title="Entre para acessar" description="A área de inclusão só existe com login institucional; não há demonstração com dados de estudantes." />} />;
}
