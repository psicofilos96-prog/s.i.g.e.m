import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RULE_PROFILES, type RuleProfile } from "@/features/assessment/assessment-rule-view";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { AssessmentRulesRealPage } from "@/features/institutional-rules/assessment-rules-page";

export type RuleSearch = { perfil: RuleProfile };

export const Route = createFileRoute("/regras-avaliativas")({
  validateSearch: (search: Record<string, unknown>): RuleSearch => ({
    perfil: RULE_PROFILES.includes(search["perfil"] as RuleProfile)
      ? (search["perfil"] as RuleProfile)
      : "supervisao",
  }),
  component: () => (
    <ClassRouteGate institutional={() => <AssessmentRulesRealPage />} laboratory={() => <Outlet />} laboratoryHasHeading />
  ),
});
