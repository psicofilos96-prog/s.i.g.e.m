import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { InstitutionalSchoolFollowupPage } from "@/features/school-institutional-followup/page";

export const Route = createFileRoute("/acompanhamento-unidades")({
  head: () => ({
    meta: [
      { title: "Acompanhamento das unidades escolares — SIGEM" },
      { name: "description", content: "Visitas, diagnósticos, planos de ação e evolução das escolas municipais, com consulta do Gabinete." },
      { property: "og:title", content: "Acompanhamento das unidades escolares — SIGEM" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate
    institutional={() => <InstitutionalSchoolFollowupPage />}
    laboratory={() => <EmptyState title="Acesso institucional" description="Entre com uma conta autorizada para acompanhar as unidades escolares." />}
  />;
}
