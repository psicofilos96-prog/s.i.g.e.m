import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { FunctionalLinkDetailPage } from "@/features/professionals/functional-link-detail-page";

export const Route = createFileRoute("/profissionais/$id/vinculos/$vinculoId")({
  head: () => ({ meta: [
    { title: `Vínculo funcional — ${brand.name}` },
    { name: "description", content: "Consulta contextual demonstrativa de um vínculo funcional e sua vigência." },
    { property: "og:title", content: `Vínculo funcional — ${brand.name}` },
    { property: "og:description", content: "Detalhe de vínculo funcional com histórico preservado e relações futuras separadas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FunctionalLinkDetailRoute,
});
function FunctionalLinkDetailRoute() {
  const { id, vinculoId } = Route.useParams();
  return <FunctionalLinkDetailPage professionalId={id} linkId={vinculoId} />;
}
