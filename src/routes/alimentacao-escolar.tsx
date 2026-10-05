import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { SchoolMealsPage } from "@/features/school-meals/school-meals-page";

export const Route = createFileRoute("/alimentacao-escolar")({
  head: () => ({
    meta: [
      { title: "Alimentação Escolar — SIGEM" },
      { name: "description", content: "Cardápios, previsão e refeições servidas por escola, com histórico e sem regra nutricional presumida." },
      { property: "og:title", content: "Alimentação Escolar — SIGEM" },
      { property: "og:description", content: "Previsto × executado por escola e período; ausência de informação nunca vira zero." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <SchoolMealsPage />} laboratory={() => <EmptyState title="Entre para acessar" description="A Alimentação Escolar só existe com login institucional." />} />;
}
