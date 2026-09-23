import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ProfessionalIdentityWorkspacePage } from "@/features/professionals/professional-identity-workspace-page";

export const Route = createFileRoute("/profissionais/editar/$id")({
  head: () => ({
    meta: [
      { title: `Editar cadastro profissional — ${brand.name}` },
      {
        name: "description",
        content:
          "Edição demonstrativa da identidade Pessoa e do papel Profissional, sem alterar vínculos funcionais.",
      },
      { property: "og:title", content: `Editar cadastro profissional — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Correção cadastral profissional com preservação das relações funcionais e do histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditProfessionalIdentityRoute,
});

function EditProfessionalIdentityRoute() {
  const { id } = Route.useParams();
  return <ProfessionalIdentityWorkspacePage mode="edicao" professionalId={id} />;
}
