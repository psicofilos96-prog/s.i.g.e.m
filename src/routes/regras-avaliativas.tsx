import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { RULE_PROFILES, type RuleProfile } from "@/features/assessment/assessment-rule-view";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";

export type RuleSearch = { perfil: RuleProfile };

/** Com sessão, as regras demonstrativas (fixtures) nunca aparecem: a norma real vive nas políticas homologadas. */
export function RealContextRulesEmpty() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-semibold">Regras avaliativas da rede</h1>
      <EmptyState
        title="Nenhuma regra avaliativa cadastrada nesta tela"
        description="Esta tela ainda só mostra exemplos de demonstração, que ficam ocultos para contas reais. As regras em vigor são as políticas de avaliação homologadas."
        action={<Button asChild variant="outline"><Link to="/">Voltar ao início</Link></Button>}
      />
    </div>
  );
}

export const Route = createFileRoute("/regras-avaliativas")({
  validateSearch: (search: Record<string, unknown>): RuleSearch => ({
    perfil: RULE_PROFILES.includes(search["perfil"] as RuleProfile)
      ? (search["perfil"] as RuleProfile)
      : "supervisao",
  }),
  component: () => (
    <ClassRouteGate institutional={() => <RealContextRulesEmpty />} laboratory={() => <Outlet />} laboratoryHasHeading />
  ),
});
