import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { NeiAgendaPage } from "@/features/inclusion/nei-agenda-page";

export const Route = createFileRoute("/inclusao_/nei_/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda, visitas e protocolos — NEI — SIGEM" },
      { name: "description", content: "Visitas técnicas, providências com prazo e protocolos com devolutiva, com acesso restrito." },
      { property: "og:title", content: "Agenda, visitas e protocolos — NEI — SIGEM" },
      { property: "og:description", content: "Visitas técnicas, providências com prazo e protocolos com devolutiva, com acesso restrito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <NeiAgendaPage />} laboratory={() => <EmptyState title="Entre para acessar" description="Esta área do NEI só existe com login institucional." />} />;
}
