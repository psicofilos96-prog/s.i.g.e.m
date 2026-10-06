import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { StudentTrajectoryPage } from "@/features/school-followup/student-trajectory-page";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/ficha-longitudinal/$id")({
  head: () => ({
    meta: [
      { title: `Ficha longitudinal do aluno — ${brand.name}` },
      { name: "description", content: "Linha do tempo autorizada de matrícula, turma, frequência, avaliação e acompanhamento, com origem de cada registro." },
      { property: "og:title", content: `Ficha longitudinal do aluno — ${brand.name}` },
      { property: "og:description", content: "Acompanhamento pedagógico do aluno conforme a autorização de cada atuação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FichaRoute,
});

function FichaRoute() {
  const { id } = Route.useParams();
  return (
    <ClassRouteGate
      institutional={() => <StudentTrajectoryPage studentId={id} />}
      laboratory={() => <EmptyState title="Entre para consultar a ficha" description="A ficha longitudinal só funciona com sua conta institucional." />}
    />
  );
}
