import { createFileRoute, Outlet } from "@tanstack/react-router";

export type StandingRuleSearch = { versao?: number };

export const Route = createFileRoute("/regras-de-situacao")({
  validateSearch: (search: Record<string, unknown>): StandingRuleSearch => {
    const raw = Number(search["versao"]);
    return Number.isFinite(raw) && raw > 0 ? { versao: raw } : {};
  },
  component: () => <Outlet />,
});
