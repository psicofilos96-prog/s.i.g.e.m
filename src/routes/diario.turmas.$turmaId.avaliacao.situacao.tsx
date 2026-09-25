import { createFileRoute } from "@tanstack/react-router";
import { AcademicStandingPage } from "@/features/assessment/academic-standing-pages";

const title = "Situação acadêmica do ciclo — SIGEM";
const description =
  "Infraestrutura configurável da situação acadêmica do ciclo: fatos consolidados, regra institucional homologada e deliberação registrada em camadas distintas, com explicação de cada critério avaliado.";

export const Route = createFileRoute("/diario/turmas/$turmaId/avaliacao/situacao")({
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
  return <AcademicStandingPage classId={turmaId} search={Route.useSearch()} />;
}
