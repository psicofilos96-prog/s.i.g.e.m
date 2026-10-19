import { describe, expect, it } from "vitest";
import { currentRiskLimit, expectedVersion, riskLimitProblems, type RiskLimitRow } from "./risk-limits";

const ok = { frequencyPct: "75", gradeCutoff: "6", reason: "Início do ano letivo" };

describe("riskLimitProblems", () => {
  it("aceita rascunho completo", () => {
    expect(riskLimitProblems(ok)).toEqual([]);
  });
  it("exige ao menos um limite", () => {
    expect(riskLimitProblems({ frequencyPct: "", gradeCutoff: "", reason: ok.reason }))
      .toContain("Informe ao menos um limite: frequência ou nota.");
  });
  it("valida faixas de frequência e nota", () => {
    expect(riskLimitProblems({ ...ok, frequencyPct: "101" })).toContain("A frequência de corte precisa estar entre 0 e 100.");
    expect(riskLimitProblems({ ...ok, gradeCutoff: "11" })).toContain("A nota de corte precisa estar entre 0 e 10.");
    expect(riskLimitProblems({ ...ok, frequencyPct: "abc" })).toContain("A frequência de corte precisa estar entre 0 e 100.");
  });
  it("exige motivo", () => {
    expect(riskLimitProblems({ ...ok, reason: " " })).toContain("Explique o motivo da alteração.");
  });
});

describe("versão vigente", () => {
  const row = (version: number): RiskLimitRow => ({ version, frequency_pct: 75, grade_cutoff: 6, reason: "r", set_at: "2027-01-01" });
  it("sem versão = não configurado, nunca padrão inventado", () => {
    expect(currentRiskLimit(null)).toBeNull();
    expect(currentRiskLimit([])).toBeNull();
    expect(expectedVersion(null)).toBe(0);
  });
  it("vigente é a versão mais recente", () => {
    expect(currentRiskLimit([row(1), row(3), row(2)])?.version).toBe(3);
    expect(expectedVersion([row(1), row(3)])).toBe(3);
  });
});
