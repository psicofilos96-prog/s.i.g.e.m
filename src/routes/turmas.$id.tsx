import { SignInRequired } from "@/components/sigem/sign-in-required";
import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import * as Inst from "@/features/classes/institutional-classes-pages";

export const Route = createFileRoute("/turmas/$id")({
  head: () => ({
    meta: [
      { title: `Turma — ${brand.name}` },
      {
        name: "description",
        content:
          "Leitura demonstrativa de uma turma: contexto acadêmico, agrupamentos, jornada, turno e matriz aplicável.",
      },
      { property: "og:title", content: `Turma — ${brand.name}` },
      {
        property: "og:description",
        content: "Contexto institucional e temporal de uma turma fictícia no SIGEM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClassDetailRoute,
});

function ClassDetailRoute() {
  const { id } = Route.useParams();
  return <ClassRouteGate laboratoryHasHeading institutional={() => <Inst.InstitutionalClassDetailPage id={id} />} laboratory={() => <SignInRequired title="Turma" what="a turma" />} />;
}
