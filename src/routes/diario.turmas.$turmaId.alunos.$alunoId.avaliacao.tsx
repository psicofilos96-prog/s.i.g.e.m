import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StudentAssessmentJourneyPage } from "@/features/assessment/assessment-student-journey-pages";
const schema = z.object({
  professor: z.string().optional(),
  unidade: z.string().optional(),
  turma: z.string().optional(),
  componente: z.string().optional(),
  ano: z.string().optional(),
  periodo: z.string().optional(),
  data: z.string().optional(),
});
export const Route = createFileRoute("/diario/turmas/$turmaId/alunos/$alunoId/avaliacao")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Percurso avaliativo do aluno — SIGEM" },
      {
        name: "description",
        content: "Trajetória avaliativa do aluno por período, sem cálculo de resultado.",
      },
      { property: "og:title", content: "Percurso avaliativo do aluno — SIGEM" },
      {
        property: "og:description",
        content: "Instrumentos, lançamentos e correções do aluno ao longo do ano letivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { turmaId, alunoId } = Route.useParams();
  return (
    <StudentAssessmentJourneyPage
      classId={turmaId}
      studentId={alunoId}
      search={Route.useSearch()}
    />
  );
}
