import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { NeiStudentPage } from "@/features/inclusion/nei-student-page";

export const Route = createFileRoute("/inclusao_/nei_/ficha")({
  head: () => ({
    meta: [
      { title: "Ficha NEI e casos — SIGEM" },
      { name: "description", content: "Ficha do NEI sobre o estudante do cadastro central e gestão de casos com histórico." },
      { property: "og:title", content: "Ficha NEI — SIGEM" },
      { property: "og:description", content: "Ficha e casos do Núcleo de Educação Inclusiva, com acesso restrito e registrado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <NeiStudentPage />} laboratory={() => <EmptyState title="Entre para acessar" description="A ficha NEI só existe com login institucional." />} />;
}
