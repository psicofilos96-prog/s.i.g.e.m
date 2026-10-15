import { createFileRoute } from "@tanstack/react-router";
import { EntityPage } from "@/features/simple/entity-page";
const Page = () => <EntityPage entityKey="staff" />;

export const Route = createFileRoute("/cadastro/servidores")({
  head: () => ({ meta: [
    { title: "Servidores — SIGEM" },
    { name: "description", content: "Cadastro de servidores da rede." },
    { property: "og:title", content: "Servidores — SIGEM" },
    { property: "og:description", content: "Cadastro de servidores da rede." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});
