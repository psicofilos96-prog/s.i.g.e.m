import { createFileRoute } from "@tanstack/react-router";
import { DocumentStudioPage } from "@/features/document-studio/document-studio-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/central-de-documentos")({
  head: () => ({
    meta: [
      { title: `Central de Documentos — ${brand.name}` },
      { name: "description", content: "Biblioteca de modelos institucionais por setor, editor seguro por blocos e prévia de impressão." },
      { property: "og:title", content: `Central de Documentos — ${brand.name}` },
      { property: "og:description", content: "Modelos de documentos institucionais versionados, com rascunho, revisão e homologação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentStudioPage,
});
