import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { SchoolFollowupPage } from "@/features/school-followup/school-followup-page";
import { GuidanceWorkspacePage } from "@/features/pedagogical-guidance/guidance-workspace-page";

export const Route = createFileRoute("/orientacao")({
  head: () => ({
    meta: [
      { title: "Portal da Orientação Pedagógica — SIGEM" },
      {
        name: "description",
        content:
          "Orientação Pedagógica da escola: sinais de atenção configurados, acompanhamentos, planos, intervenções e encaminhamentos como projeção autorizada sobre os fatos canônicos.",
      },
      { property: "og:title", content: "Portal da Orientação Pedagógica — SIGEM" },
      {
        property: "og:description",
        content:
          "Sinal não é diagnóstico: a Orientação acompanha o percurso educacional sobre fatos canônicos, com privacidade governada e histórico preservado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <SchoolFollowupPage perspective="orientacao" />} laboratory={() => <GuidanceWorkspacePage />} laboratoryHasHeading />;
}
