import { createFileRoute } from "@tanstack/react-router";
import { EntityPage } from "@/features/simple/entity-page";
const Page = () => <EntityPage entityKey="students" />;

export const Route = createFileRoute("/cadastro/alunos")({
  head: () => ({ meta: [
    { title: "Alunos — SIGEM" },
    { name: "description", content: "Cadastro de alunos da rede." },
    { property: "og:title", content: "Alunos — SIGEM" },
    { property: "og:description", content: "Cadastro de alunos da rede." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});
