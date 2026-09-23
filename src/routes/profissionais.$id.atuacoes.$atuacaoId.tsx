import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { PedagogicalDetailPage } from "@/features/pedagogical/pedagogical-detail-page";

export const Route = createFileRoute("/profissionais/$id/atuacoes/$atuacaoId")({
  head: () => ({
    meta: [
      { title: `Detalhe da atuação pedagógica — ${brand.name}` },
      {
        name: "description",
        content:
          "Detalhe demonstrativo de uma atuação pedagógica: vínculo funcional, cargo contextual, lotação relacionada, turma, componente ou campo, papel e vigência.",
      },
      { property: "og:title", content: `Detalhe da atuação pedagógica — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Substituições e corresponsabilidades são representáveis sem sobrescrever o histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PedagogicalDetailRoute,
});

function PedagogicalDetailRoute() {
  const { id, atuacaoId } = Route.useParams();
  return <PedagogicalDetailPage professionalId={id} activityId={atuacaoId} />;
}
