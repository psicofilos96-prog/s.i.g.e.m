import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { MediatorCentralPage } from "@/features/school-mediator/mediator-central-page";

export const Route = createFileRoute("/mediador/acompanhamento/$studentId")({
  head: () => ({
    meta: [
      { title: "Central de Acompanhamento — Mediador — SIGEM" },
      { name: "description", content: "Orientação vigente, registro de apoio e histórico do estudante acompanhado." },
      { property: "og:title", content: "Central de Acompanhamento — Mediador — SIGEM" },
      { property: "og:description", content: "Orientação vigente, registro de apoio e histórico do estudante acompanhado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { studentId } = Route.useParams();
  return <ClassRouteGate institutional={() => <MediatorCentralPage studentId={studentId} />} laboratory={() => <EmptyState title="Entre para acessar" description="A Central de Acompanhamento só existe com login institucional." />} />;
}
