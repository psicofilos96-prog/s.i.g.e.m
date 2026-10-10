import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { CensusMap2026Page } from "@/features/statistical-map/census-map-2026-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/mapa-censo-2026")({
  head: () => ({
    meta: [
      { title: `Mapa do Censo 2026 — ${brand.name}` },
      { name: "description", content: "Mapa escolar 2026 por escola (INEP) e da rede: turmas, alunos distintos, matrículas, vínculos, AEE, profissionais e infraestrutura." },
      { property: "og:title", content: `Mapa do Censo 2026 — ${brand.name}` },
      { property: "og:description", content: "Mapa escolar 2026 calculado a partir do banco, com conferência contra o recibo do Censo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <CensusMap2026Page />} laboratory={() => <SignInRequired title="Mapa do Censo 2026" what="o mapa escolar 2026" />} />,
});
