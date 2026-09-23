import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ContextualStudentPage } from "@/features/diary/diary-pages";
const schema = z.object({
  professor: z.string().optional(),
  unidade: z.string().optional(),
  turma: z.string().optional(),
  componente: z.string().optional(),
  ano: z.string().optional(),
  periodo: z.string().optional(),
  data: z.string().optional(),
});
export const Route = createFileRoute("/diario/turmas/$turmaId/alunos/$alunoId")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Acompanhamento do aluno — SIGEM" },
      { name: "description", content: "Perfil acadêmico contextual do aluno na turma." },
      { property: "og:title", content: "Acompanhamento do aluno — SIGEM" },
      { property: "og:description", content: "Participação e trajetória acadêmica contextual." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { turmaId, alunoId } = Route.useParams();
  return <ContextualStudentPage classId={turmaId} studentId={alunoId} search={Route.useSearch()} />;
}
