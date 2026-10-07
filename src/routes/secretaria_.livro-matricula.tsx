import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { EnrollmentBookPage } from "@/features/school-secretariat/vacancies-book-pages";

export const Route = createFileRoute("/secretaria_/livro-matricula")({
  head: () => ({
    meta: [
      { title: "Livro de Matrícula — Secretaria Escolar — SIGEM" },
      { name: "description", content: "Registro das matrículas da escola no ano letivo, com pesquisa, impressão em A4 e planilha." },
      { property: "og:title", content: "Livro de Matrícula — Secretaria Escolar — SIGEM" },
      { property: "og:description", content: "Registro das matrículas da escola no ano letivo, com pesquisa, impressão em A4 e planilha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate institutional={() => <EnrollmentBookPage />}
      laboratory={() => <EmptyState title="Entre com a conta da Secretaria" description="Livro de Matrícula mostra apenas dados oficiais da sua escola." />} />
  ),
});
