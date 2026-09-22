import { createFileRoute } from "@tanstack/react-router";
import { AllocationWorkspacePage } from "@/features/allocations/allocation-workspace-page";
import { brand } from "@/config/branding";

type MovementSearch = {
  aluno?: string | undefined;
  participacao?: string | undefined;
  turma?: string | undefined;
};

export const Route = createFileRoute("/enturmacoes/movimentar")({
  validateSearch: (search: Record<string, unknown>): MovementSearch => ({
    aluno: typeof search["aluno"] === "string" ? (search["aluno"] as string) : undefined,
    participacao:
      typeof search["participacao"] === "string" ? (search["participacao"] as string) : undefined,
    turma: typeof search["turma"] === "string" ? (search["turma"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Movimentação entre turmas — ${brand.name}` },
      {
        name: "description",
        content:
          "Fluxo demonstrativo de movimentação entre turmas: operação única que encerra a alocação anterior e cria a nova, preservando o histórico.",
      },
      { property: "og:title", content: `Movimentação entre turmas — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Movimentação de turma é mudança interna de alocação e não se confunde com transferência entre unidades.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MoveAllocationRoute,
});

function MoveAllocationRoute() {
  const { aluno, participacao, turma } = Route.useSearch();
  return (
    <AllocationWorkspacePage
      mode="movimentacao"
      studentId={aluno}
      participationId={participacao}
      classId={turma}
    />
  );
}
