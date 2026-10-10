import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { IdentityLinksPage } from "@/features/institutional-admin/identity-links-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/associacao-de-contas")({
  head: () => ({
    meta: [
      { title: `Associação de contas — ${brand.name}` },
      { name: "description", content: "Associação conta↔pessoa com identidade comprovada e revisão auditada." },
      { property: "og:title", content: `Associação de contas — ${brand.name}` },
      { property: "og:description", content: "Nome sozinho não concede acesso; segunda conta revisa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <IdentityLinksPage />} laboratory={() => <SignInRequired title="Associação de contas" what="a associação de contas" />} />,
});
