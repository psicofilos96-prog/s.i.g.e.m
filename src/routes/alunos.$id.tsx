import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { StudentRecordPage } from "@/features/students/student-record-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/alunos/$id")({
  head: () => ({
    meta: [
      { title: `Ficha escolar do aluno — ${brand.name}` },
      { name: "description", content: "Ficha escolar 2026: matrículas, turmas, etapa, AEE e fonte de cada dado, no escopo da sua conta." },
      { property: "og:title", content: `Ficha escolar do aluno — ${brand.name}` },
      { property: "og:description", content: "Matrículas, turmas e situação do aluno com a fonte de cada dado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentRecordRoute,
});

function StudentRecordRoute() {
  const { id } = Route.useParams();
  return <ClassRouteGate laboratoryHasHeading institutional={() => <StudentRecordPage id={id} />} laboratory={() => <SignInRequired title="Ficha escolar do aluno" what="a ficha do aluno" />} />;
}
