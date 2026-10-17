import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { VacancyRequestPage } from "@/features/school-secretariat/vacancy-request-page";

export const Route = createFileRoute("/secretaria_/fila-de-vagas")({
  head: () => ({
    meta: [
      { title: "Fila de vagas — Secretaria Escolar — SIGEM" },
      { name: "description", content: "Pedidos de vaga da escola na ordem de protocolo, convocação e encaminhamento à matrícula." },
      { property: "og:title", content: "Fila de vagas — Secretaria Escolar — SIGEM" },
      { property: "og:description", content: "Pedidos de vaga da escola na ordem de protocolo, convocação e encaminhamento à matrícula." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate institutional={() => <VacancyRequestPage />}
      laboratory={() => <EmptyState title="Entre com a conta da Secretaria" description="A fila de vagas mostra apenas pedidos da sua escola." />} />
  ),
});
