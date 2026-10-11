import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { NeiPage } from "@/features/inclusion/nei-page";

export const Route = createFileRoute("/inclusao_/nei")({
  head: () => ({
    meta: [
      { title: "NEI — Núcleo de Educação Inclusiva — SIGEM" },
      { name: "description", content: "Ambiente do NEI: papéis de coordenação, técnico e AEE com escopo, painel por escola e acessos registrados." },
      { property: "og:title", content: "NEI — SIGEM" },
      { property: "og:description", content: "Painel e equipe do Núcleo de Educação Inclusiva, com acesso restrito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <NeiPage />} laboratory={() => <EmptyState title="Entre para acessar" description="O NEI só existe com login institucional; não há demonstração com dados de estudantes." />} />;
}
