import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { InstitutionalEnrollmentWorkspace } from "@/features/student-life/institutional-enrollment-workspace";
import { createFileRoute } from "@tanstack/react-router";
import { EnrollmentWorkspacePage } from "@/features/enrollments/enrollment-workspace-page";
import { brand } from "@/config/branding";

type EnrollmentSearch = { aluno?: string | undefined };

export const Route = createFileRoute("/matriculas/nova")({
  validateSearch: (search: Record<string, unknown>): EnrollmentSearch => ({
    aluno: typeof search["aluno"] === "string" ? (search["aluno"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Matricular aluno em uma escola — ${brand.name}` },
      {
        name: "description",
        content:
          "Matricular um aluno já cadastrado em uma escola da rede: escolha do aluno, da escola e da data de ingresso, com conferência antes de concluir.",
      },
      { property: "og:title", content: `Matricular aluno em uma escola — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Matrícula escolar como vínculo permanente entre aluno e escola. A turma e o ano letivo pertencem a passos posteriores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewEnrollmentRoute,
});

function NewEnrollmentRoute() {
  const { aluno } = Route.useSearch();
  return <ClassRouteGate institutional={() => <InstitutionalEnrollmentWorkspace focus="matriculas" />} laboratory={() => <EnrollmentWorkspacePage studentId={aluno} />} />;
}
