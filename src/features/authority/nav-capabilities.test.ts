import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { NAV_REQUIRED_CAPABILITY, navItemAllowed } from "./nav-capabilities";
import { STATION_HOME, stationAllowsPath } from "./station-navigation";
import { provisionalNavigation } from "@/config/navigation";

const cap = (capabilityId: string) => ({ capabilityId, engagementId: "e", policyId: "p", policyVersion: 1, classId: null, periodId: null, schoolId: "a", componentId: null });
const routeFile = (to: string) => { const b = to === "/" ? "index" : to.slice(1); return [`src/routes/${b}.tsx`, `src/routes/${b}.index.tsx`, `src/routes/${b}`].find(existsSync); };

describe("NPERM.3 — menu × rota × capacidade", () => {
  it("Publicações só aparece com a capacidade de publicar", () => {
    expect(navItemAllowed("/publicacoes", [])).toBe(false);
    expect(navItemAllowed("/publicacoes", [cap("outra")])).toBe(false);
    expect(navItemAllowed("/publicacoes", [cap("publicar-conteudo-publico")])).toBe(true);
    expect(navItemAllowed("/alunos", [])).toBe(true);
  });
  it("toda regra de menu é a mesma capacidade que a tela exige (sem segunda verdade)", () => {
    const src = readFileSync("src/features/public-portal/publications-admin-page.tsx", "utf8");
    for (const c of NAV_REQUIRED_CAPABILITY["/publicacoes"]!) expect(src).toContain(`"${c}"`);
  });
  it("todo item de menu tem rota real (nenhum link morto)", () => {
    for (const g of provisionalNavigation) for (const i of g.items) expect(routeFile(i.to), i.to).toBeTruthy();
  });
  it("início de cada estação é permitido à própria estação e recusado às demais (deep link)", () => {
    for (const [st, home] of Object.entries(STATION_HOME)) {
      expect(stationAllowsPath(st, home)).toBe(true);
      for (const other of Object.keys(STATION_HOME)) if (other !== st && !home.startsWith("/unidades")) {
        if (stationAllowsPath(other, home)) expect(["/mapa-estatistico", "/paineis"].some((r) => home.startsWith(r))).toBe(true);
      }
    }
    expect(stationAllowsPath("desconhecida", "/")).toBe(false);
    expect(stationAllowsPath("secretaria_escolar", "/central-de-acessos")).toBe(false);
    expect(stationAllowsPath("secretaria_escolar", "/alunos/123")).toBe(true);
  });
  it("NPERM.4 — Integrações só aparecem com administrar-integracoes em alcance de rede", () => {
    const net = { ...cap("administrar-integracoes"), schoolId: null };
    for (const p of ["/integracoes", "/central-de-integracoes"]) {
      expect(navItemAllowed(p, [])).toBe(false);
      expect(navItemAllowed(p, [cap("administrar-integracoes")])).toBe(false);
      expect(navItemAllowed(p, [net])).toBe(true);
    }
    for (const f of ["integration-page", "institutional-page"]) expect(readFileSync(`src/features/integration/${f}.tsx`, "utf8")).toContain("administrar-integracoes");
    expect(readFileSync("drizzle/migrations/0091_integration_api_webhooks.sql", "utf8")).toContain("has_network_capability('administrar-integracoes')");
  });
  it("o bloqueio de estação envolve o conteúdo da rota, não só o menu", () => {
    const shell = readFileSync("src/components/app-shell/app-shell.tsx", "utf8");
    expect(shell).toMatch(/<StationGate pathname=\{pathname\}>/);
  });
});
