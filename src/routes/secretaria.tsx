import { createFileRoute } from "@tanstack/react-router";
import { SecretaryWorkspacePage } from "@/features/workspace/secretary-workspace-page";

export const Route = createFileRoute("/secretaria")({
  head: () => ({
    meta: [
      { title: "Secretaria Escolar — SIGEM" },
      {
        name: "description",
        content:
          "Secretaria Escolar: acompanhamento de matrículas, transferências, turmas e atendimentos do dia a dia da unidade.",
      },
      { property: "og:title", content: "Secretaria Escolar — SIGEM" },
      {
        property: "og:description",
        content:
          "O que precisa de você hoje na secretaria: matrículas, transferências, turmas e prazos da unidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecretaryWorkspacePage,
});
