import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { SchoolFollowupPage } from "@/features/school-followup/school-followup-page";
import { LeadershipWorkspacePage } from "@/features/school-leadership/leadership-workspace-page";

export const Route = createFileRoute("/direcao")({
  head: () => ({
    meta: [
      { title: "Portal da Direção Escolar — SIGEM" },
      {
        name: "description",
        content:
          "Ambiente institucional e decisório da unidade escolar: processos que exigem decisão, atos sob responsabilidade da Direção, conformidade operacional e governança local, como projeção autorizada dos fatos canônicos.",
      },
      { property: "og:title", content: "Portal da Direção Escolar — SIGEM" },
      {
        property: "og:description",
        content:
          "Cargo não autoriza: toda visualização, decisão e ato decorre de capacidade explícita, escopo, vigência, finalidade e política aplicável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <SchoolFollowupPage perspective="direcao" />} laboratory={() => <LeadershipWorkspacePage />} laboratoryHasHeading />;
}
