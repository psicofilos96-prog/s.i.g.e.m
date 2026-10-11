import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { NeiInboxPage } from "@/features/inclusion/nei-inbox-page";

export const Route = createFileRoute("/inclusao_/nei_/protocolos")({
  head: () => ({
    meta: [
      { title: "Protocolos recebidos do NEI — SIGEM" },
      { name: "description", content: "Caixa de entrada de protocolos do NEI, sem dado clínico, com devolutiva." },
      { property: "og:title", content: "Protocolos recebidos do NEI — SIGEM" },
      { property: "og:description", content: "Caixa de entrada de protocolos do NEI, sem dado clínico, com devolutiva." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <NeiInboxPage />} laboratory={() => <EmptyState title="Entre para acessar" description="Esta área do NEI só existe com login institucional." />} />;
}
