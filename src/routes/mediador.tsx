import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { MediatorPanelPage } from "@/features/school-mediator/mediator-panel-page";

export const Route = createFileRoute("/mediador")({
  head: () => ({
    meta: [
      { title: "Meu Painel — Mediador Escolar — SIGEM" },
      { name: "description", content: "Estudantes acompanhados, agenda e ações rápidas do Mediador Escolar, só por designação vigente." },
      { property: "og:title", content: "Meu Painel — Mediador Escolar — SIGEM" },
      { property: "og:description", content: "Estudantes acompanhados, agenda e ações rápidas do Mediador Escolar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <MediatorPanelPage />} laboratory={() => <EmptyState title="Entre para acessar" description="O painel do Mediador só existe com login institucional." />} />;
}
