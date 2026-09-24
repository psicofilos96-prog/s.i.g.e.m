import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AssessmentStructurePage } from "@/features/assessment/assessment-structure-page";
const schema = z.object({
  professor: z.string().optional(),
  unidade: z.string().optional(),
  turma: z.string().optional(),
  componente: z.string().optional(),
  ano: z.string().optional(),
  periodo: z.string().optional(),
  data: z.string().optional(),
  q: z.string().optional(),
  de: z.string().optional(),
  ate: z.string().optional(),
  estado: z.string().optional(),
});
export const Route = createFileRoute("/diario/turmas/$turmaId/avaliacao")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Estrutura avaliativa da turma — SIGEM" },
      {
        name: "description",
        content: "Ano letivo, períodos avaliativos, modelo de acompanhamento e pendências normativas.",
      },
      { property: "og:title", content: "Estrutura avaliativa da turma — SIGEM" },
      {
        property: "og:description",
        content: "O que está configurado e o que ainda depende de homologação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { turmaId } = Route.useParams();
  return <AssessmentStructurePage classId={turmaId} search={Route.useSearch()} />;
}
