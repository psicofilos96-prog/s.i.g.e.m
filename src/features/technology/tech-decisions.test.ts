import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TECH_DECISIONS, uncoveredDependencies } from "./tech-decisions";

const mig = readFileSync("drizzle/migrations/0500_tech13_institutional_parameters.sql", "utf8");

describe("Lote 13 — 7 decisões institucionais de Tecnologia", () => {
  it("são exatamente 7 e cobrem toda dependência declarada nos relatórios", () => {
    expect(TECH_DECISIONS).toHaveLength(7);
    expect(uncoveredDependencies()).toEqual([]);
  });
  it("cada decisão tem proposta e aprovação separadas", () => {
    for (const d of TECH_DECISIONS) {
      const rpcs = d.stage.actions.map((a) => a.rpc);
      expect(rpcs.some((r) => /^(record|mark)_/.test(r))).toBe(true);
      expect(rpcs.some((r) => r.startsWith("approve_"))).toBe(true);
    }
  });
  it("parâmetros novos: aprovador ≠ autor, versão esperada, sem semente", () => {
    expect(mig).toContain("'aprovador-igual-autor'");
    expect(mig).toContain("'versao-desatualizada'");
    expect(mig).toContain("'versao-superada'");
    expect(mig).not.toMatch(/INSERT INTO public\.tech_parameter_(versions|approvals)\s*\(\s*parameter_key[\s\S]*VALUES\s*\('/);
    expect(mig).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.tech_parameter_versions/);
  });
});
