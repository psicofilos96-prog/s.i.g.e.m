import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CieceWorkspace } from "@/features/ciece/surface/ciece-workspace";
import { LAB_CATALOG, createLaboratorySource, laboratoryAvailable } from "@/features/ciece/surface/ciece-laboratory";
import { useSessionUser } from "@/features/authority/session-authority";
import { StatePanel } from "@/components/sigem/patterns";

export const Route = createFileRoute("/laboratorio/ciece")({
  head: () => ({
    meta: [
      { title: "Laboratório do CIECE — SIGEM" },
      { name: "description", content: "Cenários fictícios para visualizar os estados dos indicadores do CIECE." },
      { property: "og:title", content: "Laboratório do CIECE — SIGEM" },
      { property: "og:description", content: "Respostas simuladas, sem dados institucionais reais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CieceLabPage,
});

function CieceLabPage() {
  const session = useSessionUser();
  const [source] = useState(createLaboratorySource);
  if (session.loading) return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>;
  if (!laboratoryAvailable(session))
    return (
      <main className="mx-auto max-w-3xl p-4">
        <StatePanel tone="warning" title="Laboratório indisponível com login institucional"
          description="Com sessão institucional ativa, só os indicadores reais podem ser exibidos, para que dados fictícios nunca se confundam com dados da rede." />
      </main>
    );
  return <CieceWorkspace source={source} catalog={LAB_CATALOG} initialReference={{ at: "2026-09-01", cycleId: "lab-ciclo-2026", periodId: "lab-periodo-2" }} />;
}
