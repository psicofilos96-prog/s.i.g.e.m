import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { CurricularCorrespondencePage } from "@/features/curriculum/curricular-correspondence";

export const Route = createFileRoute("/matrizes-curriculares/correspondencia")({
  head: () => ({
    meta: [
      { title: `Correspondência curricular — ${brand.name}` },
      { name: "description", content: "Perfis, correspondências de posição para matriz e associações específicas, com versões e homologações." },
      { property: "og:title", content: `Correspondência curricular — ${brand.name}` },
      { property: "og:description", content: "Correspondência curricular institucional com histórico append-only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <CurricularCorrespondencePage />}
      laboratory={() => (
        <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
          A correspondência curricular só existe com sessão institucional; não há versão demonstrativa.
        </p>
      )}
    />
  ),
});
