import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LessonsHistoryPage } from "@/features/diary/diary-pages";
const schema = z.object({
  professor: z.string().optional(),
  unidade: z.string().optional(),
  turma: z.string().optional(),
  componente: z.string().optional(),
  ano: z.string().optional(),
  periodo: z.string().optional(),
  data: z.string().optional(),
});
export const Route = createFileRoute("/diario/aulas")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Histórico de aulas — SIGEM" },
      { name: "description", content: "Consulta demonstrativa de aulas efetivamente registradas." },
      { property: "og:title", content: "Histórico de aulas — SIGEM" },
      {
        property: "og:description",
        content: "Histórico docente separado do planejamento semanal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  return <LessonsHistoryPage search={Route.useSearch()} />;
}
