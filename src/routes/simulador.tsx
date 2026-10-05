import { createFileRoute } from "@tanstack/react-router";
import { ScenarioPage } from "@/features/scenarios/scenario-page";

export const Route = createFileRoute("/simulador")({
  head: () => ({
    meta: [
      { title: "Simulador de cenários — SIGEM" },
      { name: "description", content: "Teste 'e se?' sobre turmas, grade e regência sem gravar nada como fato real." },
      { property: "og:title", content: "Simulador de cenários — SIGEM" },
      { property: "og:description", content: "Cenários isolados com comparação base × cenário e promoção só pela tela oficial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScenarioPage,
});
