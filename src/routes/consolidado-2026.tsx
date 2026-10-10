import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { MonthlyMap2026Page } from "@/features/statistical-map/monthly-map-2026-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/consolidado-2026")({
  head: () => ({
    meta: [
      { title: `Consolidado mensal 2026 da rede — ${brand.name}` },
      { name: "description", content: "Consolidado mensal 2026 da rede: mês de referência, situação por escola, cobertura de evidência datada e comparativo entre meses." },
      { property: "og:title", content: `Consolidado mensal 2026 da rede — ${brand.name}` },
      { property: "og:description", content: "Consolidação mensal 2026 da rede por mês de referência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <MonthlyMap2026Page mode="rede" />} laboratory={() => <SignInRequired title="Consolidado mensal 2026 da rede" what="o consolidado mensal" />} />,
});
