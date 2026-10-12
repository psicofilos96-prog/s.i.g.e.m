import { createFileRoute } from "@tanstack/react-router";
import { FormationRecordPage } from "@/features/professional-development/formation-record-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/sigem-desenvolvimento_/historico")({
  head: () => ({
    meta: [
      { title: `Histórico formativo — ${brand.name}` },
      { name: "description", content: "Histórico permanente de formação continuada: cursos, cargas, trilhas e certificados." },
      { property: "og:title", content: `Histórico formativo — ${brand.name}` },
      { property: "og:description", content: "Consulta individual e administrativa autorizada do histórico formativo." },
      { name: "robots", content: "noindex" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormationRecordPage,
});
