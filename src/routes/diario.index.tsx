import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DiaryHomePage } from "@/features/diary/diary-pages";
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
export const Route = createFileRoute("/diario/")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Meu Diário — SIGEM" },
      { name: "description", content: "Ambiente demonstrativo do professor no SIGEM." },
      { property: "og:title", content: "Meu Diário — SIGEM" },
      {
        property: "og:description",
        content: "Turmas, alunos e registros acadêmicos no contexto docente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  return <DiaryHomePage search={Route.useSearch()} />;
}
