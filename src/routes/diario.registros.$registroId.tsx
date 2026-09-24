import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LessonDetailPage } from "@/features/diary/lesson-pages";
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
export const Route = createFileRoute("/diario/registros/$registroId")({
  validateSearch: schema,
  head: ({ params }) => ({
    meta: [
      { title: `Registro de aula ${params.registroId} — SIGEM` },
      {
        name: "description",
        content: "Detalhamento demonstrativo de aula efetivamente registrada.",
      },
      { property: "og:title", content: "Registro de aula — SIGEM" },
      {
        property: "og:description",
        content: "Conteúdo, contexto, autoria e relação com o planejamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { registroId } = Route.useParams();
  return <LessonDetailPage registroId={registroId} search={Route.useSearch()} />;
}
