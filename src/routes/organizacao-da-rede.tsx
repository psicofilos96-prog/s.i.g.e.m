import { createFileRoute } from "@tanstack/react-router";
import { NetworkHubPage } from "@/features/enrollments/network-hub-page";

export const Route = createFileRoute("/organizacao-da-rede")({
  head: () => ({
    meta: [
      { title: "Organização da Rede — SIGEM" },
      { name: "description", content: "Matriz de fechamento de matrículas, vagas e oferta da rede, com evidências e bloqueios." },
      { property: "og:title", content: "Organização da Rede — SIGEM" },
      { property: "og:description", content: "Matrículas, vagas e oferta com evidências reais e bloqueios declarados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NetworkHubPage,
});
