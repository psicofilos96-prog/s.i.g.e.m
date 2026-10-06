import { createFileRoute } from "@tanstack/react-router";
import { YearPreparationPage } from "@/features/year-preparation/readiness-page";

export const Route = createFileRoute("/preparacao-2027")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Preparação do ano letivo 2027 — SIGEM" },
      { name: "description", content: "Situação de cada etapa da preparação de 2027, com motivo e atalho para o módulo responsável." },
      { property: "og:title", content: "Preparação do ano letivo 2027 — SIGEM" },
      { property: "og:description", content: "Central somente leitura: não grava nada e não abre o ano." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: YearPreparationPage,
});
