import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { FunctionalLifePage } from "@/features/professionals/functional-life-page";

export const Route = createFileRoute("/departamento-pessoal")({
  head: () => ({
    meta: [
      { title: "Departamento Pessoal — SIGEM" },
      { name: "description", content: "Vida funcional por escola: vínculos, cargo, lotação, exercício, atuação, habilitações, eventos e processos com histórico." },
      { property: "og:title", content: "Departamento Pessoal — SIGEM" },
      { property: "og:description", content: "Vida funcional canônica, com vigência e histórico, sem folha de pagamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <FunctionalLifePage />} laboratory={() => <EmptyState title="Entre para acessar" description="O Departamento Pessoal só existe com login institucional." />} />;
}
