import { createFileRoute } from "@tanstack/react-router";
import { ArchivePage } from "@/features/document-archive/archive-page";

export const Route = createFileRoute("/acervo-documental")({
  head: () => ({
    meta: [
      { title: "Acervo Documental — SIGEM" },
      { name: "description", content: "Pastas e arquivos de cada setor, com acesso por vínculo vigente, versões, lixeira e trilha." },
      { property: "og:title", content: "SIGEM — Acervo Documental" },
      { property: "og:description", content: "Acervo documental por setor com acesso restrito e auditado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArchivePage,
});
