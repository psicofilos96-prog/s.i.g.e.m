import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { installRecoveryJourneyLab, JOURNEY_LAB_CLASS_ID } from "@/features/assessment/recovery-journey-lab";
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
  const navigate = useNavigate();
  const startJourney = async () => {
    await installRecoveryJourneyLab();
    await navigate({ to: "/diario/turmas/$turmaId/avaliacao/consolidacao", params: { turmaId: JOURNEY_LAB_CLASS_ID } });
  };
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="font-display text-2xl font-semibold text-foreground">Laboratório da Recuperação Final</h1>
      <StatePanel
        tone="info"
        title="Ambiente de laboratório"
        description="Regras, fechamentos e resultados desta página são fictícios e existem só para demonstrar cada situação. Nenhuma regra real foi alterada."
      />
      <section className="rounded-md border border-border/70 p-4" aria-label="Jornada real">
        <p className="text-sm text-muted-foreground">
          Ativa uma regra e fechamentos fictícios somente na turma de laboratório e abre a Consolidação do ciclo
          oficial; o resultado da recuperação é lançado pela Pauta 2.0.
        </p>
        <Button className="mt-2" size="sm" onClick={startJourney}>
          Ativar jornada de laboratório
        </Button>
      </section>
      <ul className="divide-y divide-border/50 rounded-md border border-border/70 px-4" aria-label="Cenários de laboratório">
        {scenarios.map((s) => (
          <FinalRecoveryRow key={s.id} result={s.result} view={s.view} />
        ))}
      </ul>
    </main>
  );
}
