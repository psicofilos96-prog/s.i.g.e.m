import { DemoOnlyRoute } from "@/features/classes/demo-only-route";
import { createFileRoute } from "@tanstack/react-router";
import { MatrixWorkspacePage } from "@/features/curriculum/matrix-workspace-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/matrizes-curriculares/nova")({
  head: () => ({
    meta: [
      { title: `Nova matriz curricular (rascunho) — ${brand.name}` },
      {
        name: "description",
        content:
          "Workspace demonstrativo de elaboração de matriz curricular, com validações de experiência e sem persistência.",
      },
      { property: "og:title", content: `Nova matriz curricular — ${brand.name}` },
      {
        property: "og:description",
        content: "Rascunho de matriz curricular em workspace dedicado, sem aprovação normativa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <DemoOnlyRoute what="O editor desta tela trabalha sobre matrizes de demonstração." real="/matrizes-curriculares" realLabel="Abrir as matrizes curriculares da rede">{() => <MatrixWorkspacePage mode="nova-matriz" />}</DemoOnlyRoute>,
});
