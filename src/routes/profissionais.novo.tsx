import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ProfessionalIdentityWorkspacePage } from "@/features/professionals/professional-identity-workspace-page";

export const Route = createFileRoute("/profissionais/novo")({
  head: () => ({
    meta: [
      { title: `Novo profissional — ${brand.name}` },
      {
        name: "description",
        content:
          "Cadastro demonstrativo de Pessoa e papel Profissional, sem criação de vínculo funcional.",
      },
      { property: "og:title", content: `Novo profissional — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Workspace de identidade profissional com reutilização da Pessoa e verificação humana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ProfessionalIdentityWorkspacePage mode="novo" />,
});
