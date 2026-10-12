import { createFileRoute } from "@tanstack/react-router";
import { DevelopmentHubPage } from "@/features/professional-development/development-hub-page";

export const Route = createFileRoute("/sigem-desenvolvimento")({
  head: () => ({
    meta: [
      { title: "SIGEM Desenvolvimento — formação continuada" },
      { name: "description", content: "Catálogo de cursos, turmas, inscrições, vagas, conclusões, certificados e agenda da formação continuada." },
      { property: "og:title", content: "SIGEM Desenvolvimento" },
      { property: "og:description", content: "Formação continuada e desenvolvimento profissional com dados reais e acesso restrito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevelopmentHubPage,
});
