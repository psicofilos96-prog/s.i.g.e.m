import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MyClassesPage } from "@/features/diary/diary-pages";
import { isDiaryCloud } from "@/features/diary/diary-persistence-mode";
import { MyDiariesPage } from "@/features/teacher-diary/my-diaries-page";
import type { DiarySearch } from "@/features/diary/diary-data";
const schema = z.object({
  professor: z.string().optional(),
  unidade: z.string().optional(),
  turma: z.string().optional(),
  componente: z.string().optional(),
  ano: z.string().optional(),
  periodo: z.string().optional(),
  data: z.string().optional(),
});
export const Route = createFileRoute("/diario/turmas/")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Minhas turmas — SIGEM" },
      { name: "description", content: "Turmas, disciplinas e registros do professor no SIGEM." },
      { property: "og:title", content: "Minhas turmas — SIGEM" },
      { property: "og:description", content: "Consulta rápida das turmas do professor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const search: DiarySearch = Object.fromEntries(Object.entries(Route.useSearch()).filter(([, value]) => value !== undefined));
  return isDiaryCloud() ? <MyDiariesPage search={search} /> : <MyClassesPage search={search} />;
}
