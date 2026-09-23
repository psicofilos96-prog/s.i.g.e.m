import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { PostingsConsolePage } from "@/features/professionals/postings-console-page";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId/lotacoes/")({
  head: () => ({
    meta: [
      { title: `Lotações do vínculo funcional — ${brand.name}` },
      {
        name: "description",
        content:
          "Consulta demonstrativa de lotações vigentes e históricas de um vínculo funcional.",
      },
      { property: "og:title", content: `Lotações do vínculo funcional — ${brand.name}` },
      {
        property: "og:description",
        content: "Lotações com unidade, vigência e situação temporal próprias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostingsIndexRoute,
});

function PostingsIndexRoute() {
  const { id, vinculoId } = Route.useParams();
  return <PostingsConsolePage professionalId={id} linkId={vinculoId} />;
}
