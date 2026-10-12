import { createFileRoute } from "@tanstack/react-router";
import { AreasIndexPage } from "@/features/authority/area-workspace-page";

export const Route = createFileRoute("/areas/")({
  head: () => ({
    meta: [
      { title: "Áreas de trabalho — SIGEM" },
      { name: "description", content: "Áreas institucionais do SIGEM com as telas que competem a cada uma." },
      { property: "og:title", content: "Áreas de trabalho — SIGEM" },
      { property: "og:description", content: "Organização funcional por área, com acesso conforme atuação vigente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AreasIndexPage,
});
