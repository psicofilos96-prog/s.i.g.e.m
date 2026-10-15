import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ClassDiaryWorkspace } from "@/features/diary/class-diary/class-diary-workspace";
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
  return <ClassDiaryWorkspace search={Route.useSearch()} />;
}
