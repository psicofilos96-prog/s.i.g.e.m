import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { NeiIndicatorsPage } from "@/features/inclusion/nei-indicators-page";

export const Route = createFileRoute("/inclusao_/nei_/indicadores")({
  head: () => ({
    meta: [
      { title: "Indicadores do NEI — SIGEM" },
      { name: "description", content: "Estudantes acompanhados, planos, AEE, pendências, cobertura e tempos de resposta por escola, com fórmulas documentadas." },
      { property: "og:title", content: "Indicadores do NEI — SIGEM" },
      { property: "og:description", content: "Indicadores do Núcleo de Educação Inclusiva com acesso restrito e exportação minimizada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <NeiIndicatorsPage />} laboratory={() => <EmptyState title="Entre para acessar" description="Esta área do NEI só existe com login institucional." />} />;
}
