import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ClassDiaryWorkspace } from "@/features/diary/class-diary/class-diary-workspace";
import { isDiaryCloud } from "@/features/diary/diary-persistence-mode";
import { TeacherDayHome } from "@/features/teacher-diary/teacher-day-home";
import { TeacherNotesPage } from "@/features/teacher-diary/teacher-notes-page";
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
  aba: z.string().optional(),
});
export const Route = createFileRoute("/diario/")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Diário de Classe — SIGEM" },
      { name: "description", content: "Registro de aulas, frequência, conteúdos e avaliações da turma." },
      { property: "og:title", content: "Diário de Classe — SIGEM" },
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
  const search = Route.useSearch();
  if (isDiaryCloud()) return search.aba === "avaliacoes" ? <TeacherNotesPage search={search} /> : <TeacherDayHome search={search} />;
  return <ClassDiaryWorkspace search={search} />;
}
