import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { IntelligenceStudioPage } from "@/features/educational-intelligence/intelligence-studio-page";

export const Route = createFileRoute("/acompanhamento-avaliacao")({
  head: () => ({
    meta: [
      { title: "Acompanhamento e Avaliação — SIGEM" },
      { name: "description", content: "Estúdio de inteligência educacional: avaliações externas e internas com proveniência, natureza do dado e comparabilidade declarada." },
      { property: "og:title", content: "Acompanhamento e Avaliação — SIGEM" },
      { property: "og:description", content: "Resultados avaliativos da rede sem misturar escalas e sem ausência virar zero." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <IntelligenceStudioPage />} laboratory={() => <EmptyState title="Entre para acessar" description="O Estúdio de Inteligência só existe com login institucional." />} />;
}
