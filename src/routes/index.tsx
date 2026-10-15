import { createFileRoute } from "@tanstack/react-router";
import { SimpleHome } from "@/features/simple/home";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Início — SIGEM" },
    { name: "description", content: "Cadastre alunos, servidores, turmas e escolas e veja relatórios na hora." },
    { property: "og:title", content: "Início — SIGEM" },
    { property: "og:description", content: "Cadastre alunos, servidores, turmas e escolas e veja relatórios na hora." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SimpleHome,
});
