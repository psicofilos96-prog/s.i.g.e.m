import { createFileRoute } from "@tanstack/react-router";
import { OnboardingPage } from "@/features/onboarding/onboarding-page";

export const Route = createFileRoute("/configuracao-inicial")({
  head: () => ({
    meta: [
      { title: "Configuração inicial da escola — SIGEM" },
      { name: "description", content: "Roteiro retomável para preparar a primeira escola, conferindo fatos oficiais e a prontidão do Diário." },
      { property: "og:title", content: "Configuração inicial da escola — SIGEM" },
      { property: "og:description", content: "Checklist objetivo por turma, com links para corrigir cada cadastro oficial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});
