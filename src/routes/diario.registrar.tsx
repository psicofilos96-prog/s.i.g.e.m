import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { RegisterLessonPage } from "@/features/diary/lesson-pages";
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
  atuacao: z.string().optional(),
  bloco: z.string().optional(),
  registro: z.string().optional(),
});
export const Route = createFileRoute("/diario/registrar")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Registrar aula — SIGEM" },
      {
        name: "description",
        content: "Registro de aulas e conteúdos realizados nas turmas do professor.",
      },
      { property: "og:title", content: "Registrar aula — SIGEM" },
      {
        property: "og:description",
        content: "Selecione aulas previstas, informe o conteúdo e revise o registro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  if (isDiaryCloud()) return <MyDiariesPage search={Route.useSearch()} mode="lesson" />;
  return (
    <RegisterLessonPage key={Route.useSearch().registro ?? "novo"} search={Route.useSearch()} />
  );
}
