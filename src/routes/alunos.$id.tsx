import { createFileRoute } from "@tanstack/react-router";
import { StudentDetailPage } from "@/features/students/student-detail-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/alunos/$id")({
  head: () => ({
    meta: [
      { title: `Aluno — ${brand.name}` },
      {
        name: "description",
        content:
          "Leitura demonstrativa de um aluno: identidade permanente, matrícula escolar, vínculos letivos, participações e trajetória escolar.",
      },
      { property: "og:title", content: `Aluno — ${brand.name}` },
      {
        property: "og:description",
        content: "Trajetória escolar fictícia de um aluno no SIGEM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentDetailRoute,
});

function StudentDetailRoute() {
  const { id } = Route.useParams();
  return <StudentDetailPage id={id} />;
}
