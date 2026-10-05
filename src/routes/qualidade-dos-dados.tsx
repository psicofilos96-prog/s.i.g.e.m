import { createFileRoute } from "@tanstack/react-router";
import { DataQualityPage } from "@/features/data-quality/quality-page";

export const Route = createFileRoute("/qualidade-dos-dados")({
  head: () => ({
    meta: [
      { title: "Qualidade dos dados — SIGEM" },
      { name: "description", content: "Caixa de entrada de inconsistências objetivas dos registros oficiais, com evidência e link para correção." },
      { property: "og:title", content: "Qualidade dos dados — SIGEM" },
      { property: "og:description", content: "Inconsistências detectadas sem correção automática, por setor e escola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataQualityPage,
});
