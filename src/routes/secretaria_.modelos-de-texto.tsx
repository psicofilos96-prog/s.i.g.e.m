import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { TextTemplatesPage } from "@/features/school-documents/text-templates-page";

export const Route = createFileRoute("/secretaria_/modelos-de-texto")({
  validateSearch: (s: Record<string, unknown>) => ({ documento: s["documento"] === "ata-conselho-de-classe" ? ("ata-conselho-de-classe" as const) : undefined }),
  head: () => ({
    meta: [
      { title: "Modelos de texto da escola — SIGEM" },
      { name: "description", content: "Editor versionado do Atestado de Escolaridade e da Ata do Conselho de Classe, com geração em PDF A4." },
      { property: "og:title", content: "Modelos de texto da escola — SIGEM" },
      { property: "og:description", content: "Atestado de Escolaridade e Ata do Conselho de Classe com versões e PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { documento } = Route.useSearch();
  return <ClassRouteGate institutional={() => <TextTemplatesPage initialKind={documento} />} laboratory={() => <EmptyState title="Entre para acessar" description="Os modelos da escola só existem com login institucional." />} />;
}
