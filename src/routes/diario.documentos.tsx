import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DiaryDocumentsPage } from "@/features/diary/diary-pages";
const schema = z.object({
  professor: z.string().optional(),
  unidade: z.string().optional(),
  turma: z.string().optional(),
  componente: z.string().optional(),
  ano: z.string().optional(),
  periodo: z.string().optional(),
  data: z.string().optional(),
});
export const Route = createFileRoute("/diario/documentos")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Documentos do Diário — SIGEM" },
      {
        name: "description",
        content: "Biblioteca demonstrativa de documentos e relatórios docentes.",
      },
      { property: "og:title", content: "Documentos do Diário — SIGEM" },
      {
        property: "og:description",
        content: "Disponibilidade contextual de documentos acadêmicos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  return <DiaryDocumentsPage search={Route.useSearch()} />;
}
