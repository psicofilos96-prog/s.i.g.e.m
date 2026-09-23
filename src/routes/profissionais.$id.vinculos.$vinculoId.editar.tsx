import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { FunctionalLinkWorkspacePage } from "@/features/professionals/functional-link-workspace-page";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId/editar")({
  head: () => ({ meta: [
    { title: `Editar vínculo funcional — ${brand.name}` },
    { name: "description", content: "Manutenção demonstrativa de vínculo funcional com preservação histórica." },
    { property: "og:title", content: `Editar vínculo funcional — ${brand.name}` },
    { property: "og:description", content: "Edição administrativa contextual sem alterar Pessoa ou Profissional." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: EditFunctionalLinkRoute,
});
function EditFunctionalLinkRoute() {
  const { id, vinculoId } = Route.useParams();
  return <FunctionalLinkWorkspacePage mode="edicao" professionalId={id} linkId={vinculoId} />;
}
