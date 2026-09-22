import { createFileRoute } from "@tanstack/react-router";
import { TransferWorkspacePage } from "@/features/transfers/transfer-workspace-page";
import { brand } from "@/config/branding";

type TransferSearch = {
  aluno?: string | undefined;
  matricula?: string | undefined;
  participacao?: string | undefined;
};

export const Route = createFileRoute("/transferencias/nova")({
  validateSearch: (search: Record<string, unknown>): TransferSearch => ({
    aluno: typeof search["aluno"] === "string" ? (search["aluno"] as string) : undefined,
    matricula: typeof search["matricula"] === "string" ? (search["matricula"] as string) : undefined,
    participacao:
      typeof search["participacao"] === "string" ? (search["participacao"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Transferência escolar — ${brand.name}` },
      {
        name: "description",
        content:
          "Fluxo demonstrativo de transferência escolar: histórico da origem preservado, matrícula do destino criada ou reutilizada e nenhuma enturmação automática.",
      },
      { property: "og:title", content: `Transferência escolar — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Transferência é operação histórica com data efetiva, não alteração do campo escola do aluno.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewTransferRoute,
});

function NewTransferRoute() {
  const { aluno, matricula, participacao } = Route.useSearch();
  return (
    <TransferWorkspacePage
      studentId={aluno}
      enrollmentId={matricula}
      participationId={participacao}
    />
  );
}
