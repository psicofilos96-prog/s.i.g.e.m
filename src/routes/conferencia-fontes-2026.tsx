import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { SourceCoveragePage } from "@/features/data-import/source-coverage-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/conferencia-fontes-2026")({
  head: () => ({
    meta: [
      { title: `Conferência fonte-documento 2026 — ${brand.name}` },
      { name: "description", content: "Cobertura campo a campo dos documentos de 2026: fonte, importado, exibido e não fornecido." },
      { property: "og:title", content: `Conferência fonte-documento 2026 — ${brand.name}` },
      { property: "og:description", content: "Painel técnico de cobertura dos documentos de 2026, só com contagens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <SourceCoveragePage />} laboratory={() => <SignInRequired title="Conferência fonte-documento" what="o painel de cobertura" />} />,
});
