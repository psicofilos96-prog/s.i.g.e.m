import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AttendanceClosingPage } from "@/features/diary/attendance-closing-pages";

const description =
  "Entrega da pauta, conferência institucional e fechamento oficial da frequência do período, com fatos versionados e auditáveis.";

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

export const Route = createFileRoute("/diario/turmas/$turmaId/frequencia/fechamento")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Fechamento da frequência do período — SIGEM" },
      { name: "description", content: description },
      { property: "og:title", content: "Fechamento da frequência do período — SIGEM" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { turmaId } = Route.useParams();
  return <AttendanceClosingPage classId={turmaId} search={Route.useSearch()} />;
}
