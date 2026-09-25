import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { IdentityAdminPage } from "@/features/identity/identity-admin-page";

export const Route = createFileRoute("/identidade-institucional")({
  validateSearch: z.object({
    perfil: z.enum(["ciece", "supervisao", "escola", "professor"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Identidade institucional — SIGEM" },
      { name: "description", content: "Brasão do Município e logos da Secretaria de Educação, com histórico e vigência." },
      { property: "og:title", content: "Identidade institucional — SIGEM" },
      { property: "og:description", content: "Fonte central de brasões e logos administrada pela CIECE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { perfil } = Route.useSearch();
  const navigate = useNavigate({ from: "/identidade-institucional" });
  return (
    <IdentityAdminPage
      profile={perfil ?? "ciece"}
      onProfile={(p) => navigate({ search: { perfil: p } })}
    />
  );
}
