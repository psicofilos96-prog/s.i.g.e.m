import { createFileRoute } from "@tanstack/react-router";
import { PersonWorkspacePage } from "@/features/students/person-workspace-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/alunos/novo")({
  head: () => ({
    meta: [
      { title: `Novo aluno — ${brand.name}` },
      {
        name: "description",
        content:
          "Cadastro demonstrativo da identidade Pessoa/Aluno, com verificação de possíveis duplicidades e sem criação de matrícula escolar.",
      },
      { property: "og:title", content: `Novo aluno — ${brand.name}` },
      {
        property: "og:description",
        content: "Workspace de identidade Pessoa/Aluno no SIGEM, sem persistência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PersonWorkspacePage mode="novo" />,
});
