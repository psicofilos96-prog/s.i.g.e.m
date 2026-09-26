import { createFileRoute } from "@tanstack/react-router";
import { SecretaryWorkspacePage } from "@/features/workspace/secretary-workspace-page";

export const Route = createFileRoute("/secretaria")({
  head: () => ({
    meta: [
      { title: "Portal da Secretaria Escolar — SIGEM" },
      {
        name: "description",
        content:
          "Ambiente operacional demonstrativo da Secretaria Escolar: caixas de trabalho, busca autorizada, ficha integrada e matriz de pendências sobre os domínios canônicos da vida escolar.",
      },
      { property: "og:title", content: "Portal da Secretaria Escolar — SIGEM" },
      {
        property: "og:description",
        content:
          "Projeção operacional autorizada da vida escolar: filas derivadas, pendências explicáveis e ficha integrada composicional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecretaryWorkspacePage,
});
