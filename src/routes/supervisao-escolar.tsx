import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { SupervisionPage } from "@/features/school-supervision/supervision-page";

export const Route = createFileRoute("/supervisao-escolar")({
  head: () => ({
    meta: [
      { title: "Supervisão escolar — SIGEM" },
      { name: "description", content: "Acompanhamento das escolas pela Supervisão: situação, pendências por natureza e registros de visita versionados." },
      { property: "og:title", content: "Supervisão escolar — SIGEM" },
      { property: "og:description", content: "Situação das escolas, pendências separadas por natureza e registros da Supervisão, sem ranking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <SupervisionPage />} laboratory={() => <EmptyState title="Entre para acessar" description="A estação da Supervisão só existe com login institucional." />} />;
}
