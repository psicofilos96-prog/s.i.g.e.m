import { createFileRoute } from "@tanstack/react-router";
import { HelpPage } from "@/features/help/help-page";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Central de ajuda — SIGEM" },
      { name: "description", content: "Conceitos, glossário, fluxos e novidades do SIGEM explicados em linguagem simples." },
      { property: "og:title", content: "Central de ajuda — SIGEM" },
      { property: "og:description", content: "Entenda matrícula, alocação, matriz, homologação e outros conceitos do SIGEM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});
