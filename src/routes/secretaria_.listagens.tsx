import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { StudentListingPage } from "@/features/school-secretariat/student-listing-page";

export const Route = createFileRoute("/secretaria_/listagens")({
  head: () => ({
    meta: [
      { title: "Listagens de alunos — Secretaria Escolar — SIGEM" },
      { name: "description", content: "Listas de alunos da escola com colunas e filtros à escolha, em PDF ou Excel." },
      { property: "og:title", content: "Listagens de alunos — Secretaria Escolar — SIGEM" },
      { property: "og:description", content: "Listas de alunos da escola com colunas e filtros à escolha, em PDF ou Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate institutional={() => <StudentListingPage />}
      laboratory={() => <EmptyState title="Entre com a conta da Secretaria" description="As listagens mostram apenas alunos da sua escola." />} />
  ),
});
