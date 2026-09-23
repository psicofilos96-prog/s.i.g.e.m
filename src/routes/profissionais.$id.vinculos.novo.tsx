import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { FunctionalLinkWorkspacePage } from "@/features/professionals/functional-link-workspace-page";

export const Route = createFileRoute("/profissionais/$id/vinculos/novo")({
  head: () => ({ meta: [
    { title: `Novo vínculo funcional — ${brand.name}` },
    { name: "description", content: "Preparação demonstrativa de vínculo funcional para um profissional existente." },
    { property: "og:title", content: `Novo vínculo funcional — ${brand.name}` },
    { property: "og:description", content: "Workspace contextual de vínculo funcional, sem lotação ou função automática." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: NewFunctionalLinkRoute,
});
function NewFunctionalLinkRoute() {
  const { id } = Route.useParams();
  return <FunctionalLinkWorkspacePage mode="novo" professionalId={id} />;
}
