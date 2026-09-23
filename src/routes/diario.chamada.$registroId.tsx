import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AttendancePage } from "@/features/diary/attendance-pages";
const schema = z.object({
  professor: z.string().optional(),
  unidade: z.string().optional(),
  turma: z.string().optional(),
  componente: z.string().optional(),
  ano: z.string().optional(),
  periodo: z.string().optional(),
  data: z.string().optional(),
});
export const Route = createFileRoute("/diario/chamada/$registroId")({
  validateSearch: schema,
  head: ({ params }) => ({
    meta: [
      { title: `Chamada da aula ${params.registroId} — SIGEM` },
      { name: "description", content: "Chamada demonstrativa vinculada à aula efetivamente ministrada." },
      { property: "og:title", content: "Chamada — SIGEM" },
      { property: "og:description", content: "Lista nominal por aula, com marcações explícitas e revisão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { registroId } = Route.useParams();
  return <AttendancePage registroId={registroId} search={Route.useSearch()} />;
}
