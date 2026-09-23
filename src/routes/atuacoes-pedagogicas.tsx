import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { PedagogicalListPage } from "@/features/pedagogical/pedagogical-list-page";

export const Route = createFileRoute("/atuacoes-pedagogicas")({
  head: () => ({
    meta: [
      { title: `Atuações pedagógicas — ${brand.name}` },
      {
        name: "description",
        content:
          "Consulta demonstrativa das atuações pedagógicas: profissional, vínculo funcional, unidade, período letivo, turma, componente ou campo, papel e vigência.",
      },
      { property: "og:title", content: `Atuações pedagógicas — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Relação temporal entre profissional, vínculo funcional e contexto acadêmico, com minimização de dados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PedagogicalListPage,
});
