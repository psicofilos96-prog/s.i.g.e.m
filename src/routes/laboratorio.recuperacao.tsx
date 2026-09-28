import { createFileRoute } from "@tanstack/react-router";
import { StatePanel } from "@/components/sigem/patterns";
import { FinalRecoveryRow } from "@/features/assessment/cycle-consolidation-pages";
import { finalRecoveryLabScenarios } from "@/features/assessment/recovery-laboratory";

export const Route = createFileRoute("/laboratorio/recuperacao")({
  head: () => ({
    meta: [
      { title: "Laboratório da Recuperação Final — SIGEM" },
      { name: "description", content: "Cenários de laboratório da Recuperação Final, sem dados institucionais reais." },
      { property: "og:title", content: "Laboratório da Recuperação Final — SIGEM" },
      { property: "og:description", content: "Cenários de laboratório da Recuperação Final." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecoveryLabPage,
});

function RecoveryLabPage() {
  const scenarios = finalRecoveryLabScenarios();
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="font-display text-2xl font-semibold text-foreground">Laboratório da Recuperação Final</h1>
      <StatePanel
        tone="info"
        title="Ambiente de laboratório"
        description="Regras, fechamentos e resultados desta página são fictícios e existem só para demonstrar cada situação. Nenhuma regra real foi alterada."
      />
      <ul className="divide-y divide-border/50 rounded-md border border-border/70 px-4" aria-label="Cenários de laboratório">
        {scenarios.map((s) => (
          <FinalRecoveryRow key={s.id} result={s.result} view={s.view} />
        ))}
      </ul>
    </main>
  );
}
