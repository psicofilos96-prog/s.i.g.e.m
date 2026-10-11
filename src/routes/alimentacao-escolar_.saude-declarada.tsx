import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { SchoolHealthPage } from "@/features/family-portal/school-health-page";

export const Route = createFileRoute("/alimentacao-escolar_/saude-declarada")({
  head: () => ({
    meta: [
      { title: "Saúde declarada pela família — Alimentação Escolar — SIGEM" },
      { name: "description", content: "Restrições alimentares, alergias e medicamentos declarados pelos responsáveis, só para a equipe de alimentação da escola." },
      { property: "og:title", content: "Saúde declarada pela família — SIGEM" },
      { property: "og:description", content: "Consulta restrita e registrada das declarações de saúde da família." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <SchoolHealthPage />} laboratory={() => <EmptyState title="Entre para acessar" description="Esta consulta só existe com login institucional." />} />;
}
