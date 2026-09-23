import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { PostingWorkspacePage } from "@/features/professionals/posting-workspace-page";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId/lotacoes/nova")({
  head: () => ({
    meta: [
      { title: `Nova lotação — ${brand.name}` },
      {
        name: "description",
        content:
          "Workspace demonstrativo para registrar lotação a partir de um vínculo funcional existente.",
      },
      { property: "og:title", content: `Nova lotação — ${brand.name}` },
      {
        property: "og:description",
        content: "Destino organizacional, vigência e carga distribuída sem criar função.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewPostingRoute,
});

function NewPostingRoute() {
  const { id, vinculoId } = Route.useParams();
  return <PostingWorkspacePage mode="nova" professionalId={id} linkId={vinculoId} />;
}
