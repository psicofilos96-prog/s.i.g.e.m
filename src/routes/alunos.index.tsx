import { createFileRoute } from "@tanstack/react-router";
import { StudentsListPage } from "@/features/students/students-list-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/alunos/")({
  head: () => ({
    meta: [
      { title: `Alunos — ${brand.name}` },
      {
        name: "description",
        content:
          "Consulta demonstrativa de alunos por nome e identificadores, com vínculo escolar atual e situação contextual.",
      },
      { property: "og:title", content: `Alunos — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Alunos fictícios apresentados com minimização de dados pessoais e contexto escolar atual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentsListPage,
});
