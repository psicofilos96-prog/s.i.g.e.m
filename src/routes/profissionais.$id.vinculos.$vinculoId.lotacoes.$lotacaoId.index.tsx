import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { PostingDetailPage } from "@/features/professionals/posting-detail-page";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId/lotacoes/$lotacaoId/")(
  {
    head: () => ({
      meta: [
        { title: `Lotação — ${brand.name}` },
        {
          name: "description",
          content:
            "Consulta demonstrativa de uma lotação com unidade, vigência e carga distribuída.",
        },
        { property: "og:title", content: `Lotação — ${brand.name}` },
        {
          property: "og:description",
          content: "Lotação não determina função nem atuação pedagógica.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    }),
    component: PostingDetailRoute,
  },
);

function PostingDetailRoute() {
  const { id, vinculoId, lotacaoId } = Route.useParams();
  return <PostingDetailPage professionalId={id} linkId={vinculoId} postingId={lotacaoId} />;
}
