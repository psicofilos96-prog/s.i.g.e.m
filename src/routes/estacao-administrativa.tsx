import { createFileRoute } from "@tanstack/react-router";
import { GovernanceStationPage } from "@/features/institutional-admin/governance-station-page";

export const Route = createFileRoute("/estacao-administrativa")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Estação administrativa — SIGEM" },
      { name: "description", content: "Governança do SIGEM: quem propõe, homologa e consulta, e onde cada configuração vive." },
      { property: "og:title", content: "Estação administrativa — SIGEM" },
      { property: "og:description", content: "Leitura da política de capacidades vigente e atalhos para a configuração de cada módulo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GovernanceStationPage,
});
