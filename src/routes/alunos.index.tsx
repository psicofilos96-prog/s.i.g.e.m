import { createFileRoute } from "@tanstack/react-router";
import { StudentsListPage } from "@/features/students/students-list-page";
import { brand } from "@/config/branding";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { InstitutionalStudentsListPage } from "@/features/students/institutional-lists";

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
  // PERF.LOADING.2: com sessão, só a base institucional paginada no servidor; demonstração apenas sem sessão.
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <InstitutionalStudentsListPage />} laboratory={() => <StudentsListPage />} />,
});
