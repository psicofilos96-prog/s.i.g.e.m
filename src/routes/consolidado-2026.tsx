import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { MonthlyMap2026Page } from "@/features/statistical-map/monthly-map-2026-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/consolidado-2026")({
  head: () => ({
    meta: [
      { title: `Consolidado 2026 da rede — ${brand.name}` },
      { name: "description", content: "Consolidado 2026 da rede e por escola (INEP): turmas, alunos distintos, matrículas, vínculos, AEE, profissionais e infraestrutura." },
      { property: "og:title", content: `Consolidado 2026 da rede — ${brand.name}` },
      { property: "og:description", content: "Mapa escolar 2026 calculado a partir do banco, com conferência contra o recibo do Censo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <MonthlyMap2026Page mode="rede" />} laboratory={() => <SignInRequired title="Consolidado 2026 da rede" what="o consolidado 2026" />} />,
});
