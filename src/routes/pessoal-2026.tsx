import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { StaffRecordsPage } from "@/features/professionals/staff-records-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/pessoal-2026")({
  head: () => ({
    meta: [
      { title: `Pessoal 2026 por escola — ${brand.name}` },
      { name: "description", content: "Registros administrativos de pessoal 2026 por escola e setor, com fonte, cargo, função, vínculo e situação." },
      { property: "og:title", content: `Pessoal 2026 por escola — ${brand.name}` },
      { property: "og:description", content: "Registros administrativos de pessoal 2026, sem conceder acesso ao sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <StaffRecordsPage />} laboratory={() => <SignInRequired title="Pessoal 2026 por escola" what="os registros de pessoal" />} />,
});
