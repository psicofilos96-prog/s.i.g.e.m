import { createFileRoute } from "@tanstack/react-router";
import { AdminPanelPage } from "@/features/enrollments/admin-panel-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/matriculas_/inscricoes")({
  head: () => ({
    meta: [
      { title: `Inscrições de matrícula — ${brand.name}` },
      { name: "description", content: "Painel interno de análise das inscrições do portal: documentos, critérios, pendências e histórico." },
      { property: "og:title", content: `Inscrições de matrícula — ${brand.name}` },
      { property: "og:description", content: "Análise das inscrições por campanha, escola e competência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPanelPage,
});
