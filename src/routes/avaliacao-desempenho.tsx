import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { PerformancePage } from "@/features/performance/performance-page";

export const Route = createFileRoute("/avaliacao-desempenho")({
  head: () => ({
    meta: [
      { title: "Avaliação e Desempenho — SIGEM" },
      { name: "description", content: "Avaliações institucionais e externas da rede com resultados brutos, métricas de fórmula versionada e metas separadas." },
      { property: "og:title", content: "Avaliação e Desempenho — SIGEM" },
      { property: "og:description", content: "Dado observado, métrica calculada e meta, sem índice inventado e sem ausência virar zero." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <PerformancePage />} laboratory={() => <EmptyState title="Entre para acessar" description="Avaliação e Desempenho só existe com login institucional." />} />;
}
