import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { CensusPage } from "@/features/census-cycle/census-page";
import { EmptyState } from "@/components/sigem/patterns";

export const Route = createFileRoute("/censo-escolar")({
  head: () => ({
    meta: [
      { title: "Censo Escolar — SIGEM" },
      { name: "description", content: "Preparação, consistência e conferência anual do Censo Escolar a partir dos registros oficiais da rede." },
      { property: "og:title", content: "Censo Escolar — SIGEM" },
      { property: "og:description", content: "Fotografias imutáveis, pendências por escola e comparação com fontes externas, sem layout oficial inventado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <CensusPage />}
      laboratory={() => <EmptyState title="Entre para acessar o Censo Escolar" description="O Censo só existe com sessão institucional. Não há modo de demonstração." />}
    />
  ),
});
