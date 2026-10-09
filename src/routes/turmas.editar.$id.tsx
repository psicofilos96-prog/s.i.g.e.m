import { SignInRequired } from "@/components/sigem/sign-in-required";
import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import * as Inst from "@/features/classes/institutional-classes-pages";

export const Route = createFileRoute("/turmas/editar/$id")({
  head: () => ({
    meta: [
      { title: `Editar turma — ${brand.name}` },
      {
        name: "description",
        content:
          "Edição estrutural demonstrativa de turma, preservando o contexto atual e indicando alterações.",
      },
      { property: "og:title", content: `Editar turma — ${brand.name}` },
      {
        property: "og:description",
        content: "Página dedicada de edição demonstrativa de turma, sem persistência de dados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditClassRoute,
});

function EditClassRoute() {
  const { id } = Route.useParams();
  return <ClassRouteGate laboratoryHasHeading institutional={() => <Inst.InstitutionalClassEditPage id={id} />} laboratory={() => <SignInRequired title="Editar turma" what="e editar turmas" />} />;
}
