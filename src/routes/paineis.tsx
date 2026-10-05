import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { ExecutiveDashboardPage } from "@/features/dashboards/executive-dashboard-page";

export const Route = createFileRoute("/paineis")({
  head: () => ({
    meta: [
      { title: "Painéis executivos — SIGEM" },
      { name: "description", content: "Painéis de rede, escola e setor com números derivados dos registros oficiais, fórmula, fonte e origem de cada número." },
      { property: "og:title", content: "Painéis executivos — SIGEM" },
      { property: "og:description", content: "Métricas com definição, fórmula versionada, fonte e drill-down; não disponível nunca vira zero." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <ExecutiveDashboardPage />} laboratory={() => <EmptyState title="Entre para ver os painéis" description="Os painéis só existem com login e mostram apenas o que suas permissões alcançam." />} />;
}
