import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EnrollmentWizard } from "@/features/school-secretariat/enrollment-wizard";
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
      { title: `Nova matrícula guiada — ${brand.name}` },
      {
        name: "description",
        content:
          "Matricular um aluno já cadastrado em uma escola da rede: escolha do aluno, da escola e da data de ingresso, com conferência antes de concluir.",
      },
      { property: "og:title", content: `Nova matrícula guiada — ${brand.name}` },
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
  return <ClassRouteGate institutional={() => <EnrollmentWizard />} laboratory={() => <EnrollmentWorkspacePage studentId={aluno} />} />;
}
