import { SignInRequired } from "@/components/sigem/sign-in-required";
import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import * as Inst from "@/features/classes/institutional-classes-pages";

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
  component: () => <ClassRouteGate laboratoryHasHeading institutional={() => <Inst.InstitutionalClassesListPage />} laboratory={() => <SignInRequired title="Turmas" what="as turmas" />} />,
});
