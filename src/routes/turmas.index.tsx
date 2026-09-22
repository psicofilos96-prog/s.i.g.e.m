import { createFileRoute } from "@tanstack/react-router";
import { ClassesListPage } from "@/features/classes/classes-list-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/turmas/")({
  head: () => ({
    meta: [
      { title: `Turmas — ${brand.name}` },
      {
        name: "description",
        content:
          "Consulta demonstrativa de turmas por unidade, período letivo, organização acadêmica e agrupamentos.",
      },
      { property: "og:title", content: `Turmas — ${brand.name}` },
      {
        property: "og:description",
        content: "Turmas fictícias apresentadas em seu contexto institucional e temporal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClassesListPage,
});
