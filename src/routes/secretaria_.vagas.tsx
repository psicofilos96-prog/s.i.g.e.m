import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { VacanciesPage } from "@/features/school-secretariat/vacancies-book-pages";

export const Route = createFileRoute("/secretaria_/vagas")({
  head: () => ({
    meta: [
      { title: "Vagas — Secretaria Escolar — SIGEM" },
      { name: "description", content: "Capacidade e ocupação das turmas da escola: há vaga, lotada ou capacidade não informada." },
      { property: "og:title", content: "Vagas — Secretaria Escolar — SIGEM" },
      { property: "og:description", content: "Capacidade e ocupação das turmas da escola: há vaga, lotada ou capacidade não informada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate institutional={() => <VacanciesPage />}
      laboratory={() => <EmptyState title="Entre com a conta da Secretaria" description="Vagas mostra apenas dados oficiais da sua escola." />} />
  ),
});
