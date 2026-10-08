import { DemoOnlyRoute } from "@/features/classes/demo-only-route";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export type StandingRuleSearch = { versao?: number };

export const Route = createFileRoute("/regras-de-situacao")({
  validateSearch: (search: Record<string, unknown>): StandingRuleSearch => {
    const raw = Number(search["versao"]);
    return Number.isFinite(raw) && raw > 0 ? { versao: raw } : {};
  },
  component: () => <DemoOnlyRoute what="As regras de situação desta tela são de demonstração." real="/regras-institucionais" realLabel="Abrir regras institucionais">{() => <Outlet />}</DemoOnlyRoute>,
});
