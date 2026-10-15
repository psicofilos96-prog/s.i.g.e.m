import { createFileRoute } from "@tanstack/react-router";
import { EntityPage } from "@/features/simple/entity-page";
const Page = () => <EntityPage entityKey="classes" />;

export const Route = createFileRoute("/cadastro/turmas")({
  head: () => ({ meta: [
    { title: "Turmas — SIGEM" },
    { name: "description", content: "Cadastro de turmas da rede." },
    { property: "og:title", content: "Turmas — SIGEM" },
    { property: "og:description", content: "Cadastro de turmas da rede." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});
