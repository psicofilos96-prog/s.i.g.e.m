import { createFileRoute } from "@tanstack/react-router";
import { PublicationsAdminPage } from "@/features/public-portal/publications-admin-page";

export const Route = createFileRoute("/publicacoes")({
  head: () => ({
    meta: [
      { title: "Publicações do portal público — SIGEM" },
      { name: "description", content: "Gestão versionada do que é publicado sem autenticação." },
      { property: "og:title", content: "Publicações do portal público — SIGEM" },
      { property: "og:description", content: "Rascunho, publicação e revogação versionados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicationsAdminPage,
});
