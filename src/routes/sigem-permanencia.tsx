import { createFileRoute } from "@tanstack/react-router";
import { PermanenceHubPage } from "@/features/permanence/permanence-hub-page";

export const Route = createFileRoute("/sigem-permanencia")({
  head: () => ({
    meta: [
      { title: "SIGEM Permanência — acompanhamento escolar" },
      { name: "description", content: "Painel, central de casos, ficha com linha do tempo, agenda, mapa agregado e relatórios de permanência escolar." },
      { property: "og:title", content: "SIGEM Permanência — acompanhamento escolar" },
      { property: "og:description", content: "Busca ativa e permanência com privacidade, autoria real e dados mínimos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PermanenceHubPage,
});
