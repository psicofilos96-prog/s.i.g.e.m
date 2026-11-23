import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { InstitutionalEnrollmentWorkspace } from "@/features/student-life/institutional-enrollment-workspace";
import { createFileRoute } from "@tanstack/react-router";
import { AllocationWorkspacePage } from "@/features/allocations/allocation-workspace-page";
import { brand } from "@/config/branding";

type AllocationSearch = {
  aluno?: string | undefined;
  participacao?: string | undefined;
  turma?: string | undefined;
};

export const Route = createFileRoute("/enturmacoes/nova")({
  validateSearch: (search: Record<string, unknown>): AllocationSearch => ({
    aluno: typeof search["aluno"] === "string" ? (search["aluno"] as string) : undefined,
    participacao:
      typeof search["participacao"] === "string" ? (search["participacao"] as string) : undefined,
    turma: typeof search["turma"] === "string" ? (search["turma"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Enturmação e alocação em turma — ${brand.name}` },
      {
        name: "description",
        content:
          "Coloque o aluno matriculado na turma em que vai estudar. O histórico da matrícula e da turma é preservado.",
      },
      { property: "og:title", content: `Enturmação e alocação em turma — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Enturmação: colocar o aluno na turma certa. A turma pode mudar ao longo do ano, e o histórico de cada mudança é preservado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewAllocationRoute,
});

function NewAllocationRoute() {
  const { aluno, participacao, turma } = Route.useSearch();
  return <ClassRouteGate institutional={() => <InstitutionalEnrollmentWorkspace focus="enturmacoes" initialClassId={turma ?? ""} />} laboratory={() => (
    <AllocationWorkspacePage
      mode="enturmacao"
      studentId={aluno}
      participationId={participacao}
      classId={turma}
    />
  )} />;
}
