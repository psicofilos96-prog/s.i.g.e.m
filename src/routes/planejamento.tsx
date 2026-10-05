import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { PlanningPage } from "@/features/teaching-planning/planning-page";

export const Route = createFileRoute("/planejamento")({
  head: () => ({
    meta: [
      { title: "Planejamento docente — SIGEM" },
      { name: "description", content: "Planejamento do professor ligado à regência vigente, com blocos livres, elementos da matriz, habilidades BNCC/SAEB e histórico de versões." },
      { property: "og:title", content: "Planejamento docente — SIGEM" },
      { property: "og:description", content: "Rascunho, compartilhamento e cópia com proveniência; planejar não registra aula." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <PlanningPage />} laboratory={() => <EmptyState title="Entre para planejar" description="O planejamento só existe com login e para regências suas." />} />;
}
