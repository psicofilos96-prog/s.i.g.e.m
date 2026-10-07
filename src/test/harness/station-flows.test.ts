import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { stationAllowsPath } from "@/features/authority/station-navigation";
import { STATION_FLOWS, coverageReport } from "./station-flows";

const AREAS = ["Secretaria", "CIECE", "Supervisão", "Avaliação", "OP", "Direção", "Alimentação", "Docente", "Admin"];

describe("NTEST.2 — fluxos consolidados", () => {
  it("cobre as nove áreas pedidas", () => expect(new Set(STATION_FLOWS.map((f) => f.area))).toEqual(new Set(AREAS)));
  for (const f of STATION_FLOWS.filter((x) => x.station))
    it(`${f.area}: ${f.flow} — rotas alcançáveis pela estação`, () => {
      for (const r of f.routes) expect(stationAllowsPath(f.station!, r), r).toBe(true);
    });
  it("perfis dos fluxos existem no manifesto sintético", () => {
    const src = readFileSync("scripts/bo-fixture-harness.mjs", "utf8");
    for (const p of STATION_FLOWS.flatMap((f) => (f.profile ? [f.profile] : []))) expect(src).toContain(`"${p}"`);
  });
  it("fluxo sem perfil sintético nunca é declarado como camada autenticada", () => {
    for (const f of STATION_FLOWS.filter((x) => !x.profile)) expect(f.proof).toBe("static");
  });
  it("nenhum fluxo declara browser por conta própria", () => expect(STATION_FLOWS.some((f) => f.proof === "browser")).toBe(false));
  it("sem sessão aprovada o relatório marca pendência de navegador em todos", () =>
    expect(coverageReport(false).every((r) => r.pending === "INTERACTIVE_BROWSER_VALIDATION_PENDING" && r.layer !== "browser")).toBe(true));
  it("com sessão aprovada, fluxo estático continua estático", () =>
    expect(coverageReport(true).filter((r) => r.layer === "static").length).toBe(STATION_FLOWS.filter((f) => f.proof === "static").length));
  it("runner exige a porta antes de qualquer suíte", () => {
    const src = readFileSync("scripts/institutional-harness.mjs", "utf8");
    expect(src.indexOf("resolveHarness")).toBeLessThan(src.indexOf("vitest"));
  });
});
