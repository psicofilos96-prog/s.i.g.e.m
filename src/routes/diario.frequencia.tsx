import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { FrequencyPage } from "@/features/diary/attendance-pages";
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
export const Route = createFileRoute("/diario/frequencia")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Frequência — SIGEM" },
      {
        name: "description",
        content: "Quantitativos demonstrativos de aulas, chamadas, presenças e faltas.",
      },
      { property: "og:title", content: "Frequência — SIGEM" },
      {
        property: "og:description",
        content: "Quantitativos demonstrativos de aulas, chamadas, presenças e faltas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  return <FrequencyPage search={Route.useSearch()} />;
}
