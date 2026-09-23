import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ClassStudentsPage } from "@/features/diary/diary-pages";
const schema = z.object({
  professor: z.string().optional(),
  unidade: z.string().optional(),
  turma: z.string().optional(),
  componente: z.string().optional(),
  ano: z.string().optional(),
  periodo: z.string().optional(),
  data: z.string().optional(),
});
export const Route = createFileRoute("/diario/turmas/$turmaId/alunos/")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Alunos da turma — SIGEM" },
      { name: "description", content: "Consulta contextual e temporal dos alunos da turma." },
      { property: "og:title", content: "Alunos da turma — SIGEM" },
      {
        property: "og:description",
        content: "Participações e alocações válidas na data consultada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { turmaId } = Route.useParams();
  return <ClassStudentsPage classId={turmaId} search={Route.useSearch()} />;
}
