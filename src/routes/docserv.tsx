import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { DocservPage } from "@/features/docserv/docserv-page";
import { EmptyState } from "@/components/sigem/patterns";

export const Route = createFileRoute("/docserv")({
  head: () => ({
    meta: [
      { title: "DocServ — documentos funcionais — SIGEM" },
      { name: "description", content: "Documentos funcionais de servidores, escolas e rede dentro do SIGEM, com o mesmo login e cadastro." },
      { property: "og:title", content: "DocServ — documentos funcionais — SIGEM" },
      { property: "og:description", content: "Módulo nativo de documentos funcionais do SIGEM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <DocservPage />}
      laboratory={() => <EmptyState title="Entre para acessar o DocServ" description="Os documentos funcionais só existem com sessão institucional." />}
    />
  ),
});
