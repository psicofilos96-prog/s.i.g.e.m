import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { NeiSupportPage } from "@/features/inclusion/nei-support-page";

export const Route = createFileRoute("/inclusao_/nei_/apoio")({
  head: () => ({
    meta: [
      { title: "Profissionais de apoio e acessibilidade — NEI — SIGEM" },
      { name: "description", content: "Pedidos de apoio, designações, cobertura de mediadores e barreiras de acessibilidade por escola." },
      { property: "og:title", content: "Apoio e acessibilidade — NEI" },
      { property: "og:description", content: "Gestão do NEI sobre profissionais existentes e barreiras, com acesso restrito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <NeiSupportPage />} laboratory={() => <EmptyState title="Entre para acessar" description="Esta área do NEI só existe com login institucional." />} />;
}
