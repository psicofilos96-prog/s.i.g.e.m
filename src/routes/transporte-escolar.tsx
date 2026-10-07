import { createFileRoute } from "@tanstack/react-router";
import { TransportPage } from "@/features/school-transport/transport-page";

export const Route = createFileRoute("/transporte-escolar")({
  head: () => ({
    meta: [
      { title: "Transporte escolar — SIGEM" },
      { name: "description", content: "Rotas, pontos e estudantes atendidos pelo transporte escolar, por escola." },
      { property: "og:title", content: "Transporte escolar — SIGEM" },
      { property: "og:description", content: "Rotas, pontos e estudantes atendidos pelo transporte escolar, por escola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransportPage,
});
