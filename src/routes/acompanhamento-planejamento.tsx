import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { PlansOverviewPage } from "@/features/teaching-planning/plans-overview-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/acompanhamento-planejamento")({
  head: () => ({
    meta: [
      { title: `Acompanhamento do planejamento — ${brand.name}` },
      { name: "description", content: "Consulta somente leitura dos planejamentos compartilhados, conforme a autorização da sua atuação." },
      { property: "og:title", content: `Acompanhamento do planejamento — ${brand.name}` },
      { property: "og:description", content: "Orientação, Direção e rede acompanham o planejamento sem editar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <PlansOverviewPage />}
      laboratory={() => <EmptyState title="Entre para acompanhar o planejamento" description="A consulta só funciona com sua conta institucional." />}
    />
  ),
});
