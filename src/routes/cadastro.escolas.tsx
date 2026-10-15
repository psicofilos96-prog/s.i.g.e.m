import { createFileRoute } from "@tanstack/react-router";
import { EntityPage } from "@/features/simple/entity-page";
const Page = () => <EntityPage entityKey="schools" />;

export const Route = createFileRoute("/cadastro/escolas")({
  head: () => ({ meta: [
    { title: "Escolas — SIGEM" },
    { name: "description", content: "Cadastro de escolas da rede." },
    { property: "og:title", content: "Escolas — SIGEM" },
    { property: "og:description", content: "Cadastro de escolas da rede." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});
