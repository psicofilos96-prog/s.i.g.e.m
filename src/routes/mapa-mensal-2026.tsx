import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { MonthlyMap2026Page } from "@/features/statistical-map/monthly-map-2026-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/mapa-mensal-2026")({
  head: () => ({
    meta: [
      { title: `Mapa Estatístico mensal 2026 — ${brand.name}` },
      { name: "description", content: "Mapa Estatístico por escola e mês de referência de 2026, com consolidação da rede, comparativo entre meses e apuração congelada." },
      { property: "og:title", content: `Mapa Estatístico mensal 2026 — ${brand.name}` },
      { property: "og:description", content: "Mapa mensal por escola e rede, lido na data de referência de cada mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <MonthlyMap2026Page />} laboratory={() => <SignInRequired title="Mapa Estatístico mensal 2026" what="o mapa mensal" />} />,
});
