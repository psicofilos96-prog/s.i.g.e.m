import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { ManagementPage } from "@/features/school-management/management-page";

export const Route = createFileRoute("/gestao-escolar")({
  head: () => ({
    meta: [
      { title: "Gestão escolar — SIGEM" },
      { name: "description", content: "Situação operacional da escola para a Direção, montada dos registros oficiais, com pendências explicáveis." },
      { property: "og:title", content: "Gestão escolar — SIGEM" },
      { property: "og:description", content: "Matrículas, turmas, grade, Diário, planejamento, fechamentos, comunicação, AEE e alimentação em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <ManagementPage />} laboratory={() => <EmptyState title="Entre para acessar" description="A estação da gestão escolar só existe com login institucional." />} />;
}
