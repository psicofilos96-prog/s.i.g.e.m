import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { InfrequencyPage } from "@/features/school-secretariat/infrequency-page";

export const Route = createFileRoute("/secretaria_/infrequencia")({
  head: () => ({
    meta: [
      { title: "Aviso de infrequência — Secretaria Escolar — SIGEM" },
      { name: "description", content: "Alunos abaixo da frequência mínima no período e emissão do aviso ao responsável." },
      { property: "og:title", content: "Aviso de infrequência — Secretaria Escolar — SIGEM" },
      { property: "og:description", content: "Alunos abaixo da frequência mínima no período e emissão do aviso ao responsável." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate institutional={() => <InfrequencyPage />}
      laboratory={() => <EmptyState title="Entre com a conta da Secretaria" description="Os avisos mostram apenas alunos da sua escola." />} />
  ),
});
