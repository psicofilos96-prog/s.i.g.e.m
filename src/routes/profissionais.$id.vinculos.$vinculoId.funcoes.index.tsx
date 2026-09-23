import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { AssignmentsConsolePage } from "@/features/professionals/assignments-console-page";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId/funcoes/")({
  head: () => ({
    meta: [
      { title: `Atribuições de função do vínculo — ${brand.name}` },
      {
        name: "description",
        content:
          "Consulta demonstrativa das atribuições de função atuais e históricas de um vínculo funcional.",
      },
      { property: "og:title", content: `Atribuições de função do vínculo — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Função, contexto institucional e vigência próprios, sem alterar cargo ou lotação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssignmentsIndexRoute,
});

function AssignmentsIndexRoute() {
  const { id, vinculoId } = Route.useParams();
  return <AssignmentsConsolePage professionalId={id} linkId={vinculoId} />;
}
