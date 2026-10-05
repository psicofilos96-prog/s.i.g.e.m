import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { ReferencePage } from "@/features/curricular-reference/reference-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/referencias-curriculares")({
  head: () => ({
    meta: [
      { title: `Referências curriculares — ${brand.name}` },
      { name: "description", content: "Glossário das fontes curriculares oficiais com texto integral, descrição simplificada e relações entre itens." },
      { property: "og:title", content: `Referências curriculares — ${brand.name}` },
      { property: "og:description", content: "Habilidades e descritores com texto oficial preservado e edições versionadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <ReferencePage />}
      laboratory={() => <EmptyState title="Entre para consultar" description="As referências curriculares oficiais só são lidas com sessão institucional." />}
    />
  ),
});
