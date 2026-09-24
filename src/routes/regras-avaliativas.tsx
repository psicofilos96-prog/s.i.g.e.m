import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RULE_PROFILES, type RuleProfile } from "@/features/assessment/assessment-rule-view";

export type RuleSearch = { perfil: RuleProfile };

export const Route = createFileRoute("/regras-avaliativas")({
  validateSearch: (search: Record<string, unknown>): RuleSearch => ({
    perfil: RULE_PROFILES.includes(search["perfil"] as RuleProfile)
      ? (search["perfil"] as RuleProfile)
      : "supervisao",
  }),
  component: () => <Outlet />,
});
