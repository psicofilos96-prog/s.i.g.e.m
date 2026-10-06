import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { CommunicationPage } from "@/features/communication/communication-page";

export const Route = createFileRoute("/comunicacao-escolar")({
  head: () => ({
    meta: [
      { title: "Comunicação com as famílias — SIGEM" },
      { name: "description", content: "Comunicados da escola publicados no SIGEM para responsáveis autorizados, com versões, ciência e histórico." },
      { property: "og:title", content: "Comunicação com as famílias — SIGEM" },
      { property: "og:description", content: "Rascunho, publicação, correção e cancelamento de comunicados escolares com autoria e escopo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <CommunicationPage />} laboratory={() => <EmptyState title="Entre para acessar" description="A comunicação com as famílias só existe com login institucional." />} />;
}
