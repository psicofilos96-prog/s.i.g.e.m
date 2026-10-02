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
          "Fluxo demonstrativo de alocação em turma a partir de uma participação existente, com vigência própria e preservação do histórico.",
      },
      { property: "og:title", content: `Enturmação e alocação em turma — ${brand.name}` },
      {
        property: "og:description",
        content:
          "A alocação é a relação temporal entre participação e turma: o aluno não possui turma como atributo permanente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewAllocationRoute,
});

function NewAllocationRoute() {
  const { aluno, participacao, turma } = Route.useSearch();
  return <ClassRouteGate institutional={() => <InstitutionalEnrollmentWorkspace focus="enturmacoes" />} laboratory={() => (
    <AllocationWorkspacePage
      mode="enturmacao"
      studentId={aluno}
      participationId={participacao}
      classId={turma}
    />
  )} />;
}
