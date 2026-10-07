import { createFileRoute } from "@tanstack/react-router";
import { InfrastructureNetworkPage } from "@/features/schools/infrastructure-network-page";

export const Route = createFileRoute("/infraestrutura")({
  head: () => ({
    meta: [
      { title: "Infraestrutura das escolas — SIGEM" },
      { name: "description", content: "O que cada escola já informou sobre sua infraestrutura e o que falta informar." },
      { property: "og:title", content: "Infraestrutura das escolas — SIGEM" },
      { property: "og:description", content: "O que cada escola já informou sobre sua infraestrutura e o que falta informar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InfrastructureNetworkPage,
});
