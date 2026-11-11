import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AttendanceHistoryPage } from "@/features/diary/attendance-pages";
import { isDiaryCloud } from "@/features/diary/diary-persistence-mode";
import { MyDiariesPage } from "@/features/teacher-diary/my-diaries-page";
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
export const Route = createFileRoute("/diario/chamadas")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Histórico de chamadas — SIGEM" },
      {
        name: "description",
        content: "Chamadas por data, escola, turma, componente, profissional e estado.",
      },
      { property: "og:title", content: "Histórico de chamadas — SIGEM" },
      {
        property: "og:description",
        content: "Chamadas por data, escola, turma, componente, profissional e estado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  if (isDiaryCloud()) return <MyDiariesPage search={Route.useSearch()} mode="attendance" />;
  return <AttendanceHistoryPage search={Route.useSearch()} />;
}
