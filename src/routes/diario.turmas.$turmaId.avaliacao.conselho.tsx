import { createFileRoute } from "@tanstack/react-router";
import { CollegialPage } from "@/features/collegial/collegial-pages";

const title = "Colegiados e deliberações institucionais — SIGEM";
const description =
  "Infraestrutura configurável de colegiados: sessão, pauta, deliberação e ata estruturada como registros distintos, com composição, quórum, forma de decisão e assinatura declarados pela configuração do órgão.";

export const Route = createFileRoute("/diario/turmas/$turmaId/avaliacao/conselho")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { turmaId } = Route.useParams();
  return <CollegialPage classId={turmaId} search={Route.useSearch()} />;
}
