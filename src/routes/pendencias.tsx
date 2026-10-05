import { createFileRoute } from "@tanstack/react-router";
import { PendingsPage } from "@/features/workflows/pendings-page";

export const Route = createFileRoute("/pendencias")({
  head: () => ({
    meta: [
      { title: "Pendências — SIGEM" },
      { name: "description", content: "Minhas pendências, pendências do setor e histórico dos processos em tramitação." },
      { property: "og:title", content: "Pendências — SIGEM" },
      { property: "og:description", content: "Processos multi-etapa com histórico imutável e ações por capacidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PendingsPage,
});
