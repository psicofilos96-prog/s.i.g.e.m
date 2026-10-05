import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { DesignationPreviewPage } from "@/features/classes/designation-preview-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/turmas/designacao-previa")({
  head: () => ({
    meta: [
      { title: `Prévia da designação de turmas — ${brand.name}` },
      { name: "description", content: "Simulação, sem gravar, da padronização 100…900 das turmas do Ensino Fundamental para apresentação ao Gabinete." },
      { property: "og:title", content: `Prévia da designação de turmas — ${brand.name}` },
      { property: "og:description", content: "Designações atuais, propostas, divergências e casos não determináveis por escola e ano." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <DesignationPreviewPage />}
      laboratory={() => <EmptyState title="Entre para ver a prévia" description="A prévia usa somente turmas oficiais." />}
    />
  ),
});
