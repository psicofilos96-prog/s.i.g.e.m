import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { StaffReconciliationPage } from "@/features/professionals/staff-reconciliation-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/conciliacao-pessoal")({
  head: () => ({
    meta: [
      { title: `Conciliação de pessoal 2026 — ${brand.name}` },
      { name: "description", content: "Conferência assistida dos registros de pessoal 2026 contra o Censo, com decisão humana e evidência." },
      { property: "og:title", content: `Conciliação de pessoal 2026 — ${brand.name}` },
      { property: "og:description", content: "Sugestões por nome conferidas por quem tem competência; nada concede acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <StaffReconciliationPage />} laboratory={() => <SignInRequired title="Conciliação de pessoal" what="a conciliação de pessoal" />} />,
});
