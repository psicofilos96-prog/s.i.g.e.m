import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { ROUTE_GUIDES, guideForPath } from "./route-guides";
import { STATION_HOME } from "@/features/authority/station-navigation";

const routeFile = (to: string) => `src/routes/${to.slice(1).replace(/\//g, ".")}.tsx`;
const exists = (to: string) => existsSync(routeFile(to)) || existsSync(routeFile(to).replace("alimentacao-escolar.", "alimentacao-escolar_."));

describe("NHOME.1 — homes de estação", () => {
  it("toda home de estação, e a Administração, diz quem sou e o que fazer", () => {
    for (const home of [...Object.values(STATION_HOME), "/administracao"]) {
      const g = guideForPath(home);
      expect(g, home).not.toBeNull();
      expect(g!.where.length).toBeGreaterThan(0);
      expect(g!.todo.length).toBeLessThanOrEqual(80); // texto curto
    }
  });
  it("ação principal sempre leva a uma página que existe", () => {
    for (const [path, g] of Object.entries(ROUTE_GUIDES)) if (g.primary) expect(exists(g.primary.to), `${path} → ${g.primary.to}`).toBe(true);
  });
  it("ação principal nunca afirma dado (sem números no rótulo nem no texto)", () => {
    for (const g of Object.values(ROUTE_GUIDES)) for (const t of [g.todo, g.next ?? "", g.primary?.label ?? ""]) expect(t).not.toMatch(/\d/);
  });
  it("estações sem ação destacada na própria tela ganham ação principal no guia", () => {
    for (const p of ["/ciece", "/alimentacao-escolar", "/avaliacao-desempenho", "/administracao"]) expect(ROUTE_GUIDES[p]!.primary).toBeDefined();
  });
  it("o guia mostra a ação principal como botão", () => {
    expect(readFileSync("src/components/app-shell/app-shell.tsx", "utf8")).toContain("<Link to={g.primary.to}>{g.primary.label}</Link>");
  });
});
