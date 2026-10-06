import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { FunctionalLifePage } from "@/features/professionals/functional-life-page";

export const Route = createFileRoute("/departamento-pessoal")({
  head: () => ({
    meta: [
      { title: "Dados funcionais do DP externo — SIGEM" },
      { name: "description", content: "Consulta dos dados funcionais informados pelo Departamento Pessoal externo; o SIGEM não administra vida funcional." },
      { property: "og:title", content: "Dados funcionais do DP externo — SIGEM" },
      { property: "og:description", content: "O DP externo é a autoridade funcional; o SIGEM só consome os dados para a operação educacional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <FunctionalLifePage />} laboratory={() => <EmptyState title="Entre para acessar" description="A consulta dos dados funcionais exige login institucional." />} />;
}
