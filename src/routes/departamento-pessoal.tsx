import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { FunctionalLifePage } from "@/features/professionals/functional-life-page";

export const Route = createFileRoute("/departamento-pessoal")({
  head: () => ({
    meta: [
      { title: "Vida funcional — DP administrativo — SIGEM" },
      { name: "description", content: "Vínculos, lotações, exercícios, eventos e processos por escola, com linha do tempo funcional. Sem folha ou previdência." },
      { property: "og:title", content: "Vida funcional — DP administrativo — SIGEM" },
      { property: "og:description", content: "Vida funcional administrativa dentro do SIGEM; folha, previdência, pensão e consignações ficam fora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <FunctionalLifePage />} laboratory={() => <EmptyState title="Entre para acessar" description="A consulta dos dados funcionais exige login institucional." />} />;
}
