import { describe, it, expect } from "vitest";
import { AA_INDICATORS, compute, series, periodKey, DASHBOARDS, explainChart } from "./aa-indicator-library";

const none = new Set<string>();
describe("A&A L16 indicadores, séries e painéis", () => {
  it("biblioteca declara método e painéis só usam indicadores catalogados", () => {
    for (const d of AA_INDICATORS) expect(d.numerator && d.denominator && d.source && d.limitations.length).toBeTruthy();
    const keys = new Set(AA_INDICATORS.map(d => d.key));
    for (const b of Object.values(DASHBOARDS)) for (const i of b.indicators) expect(keys.has(i)).toBe(true);
  });
  it("calcula com explicação; ausência e regra faltante nunca viram zero", () => {
    const v = compute("participacao", { numerator: 40, denominator: 50, at: "2026-04-01", sourceRef: "ed1" }, none);
    expect(v).toMatchObject({ state: "calculado", value: 0.8 });
    expect(v.explanation).toMatch(/40 .* 50/);
    expect(compute("participacao", { numerator: 0, denominator: 0, at: "x", sourceRef: "x" }, none).value).toBeNull();
    expect(compute("participacao", { unread: "sem permissão" }, none).state).toBe("nao-lido");
    expect(compute("distribuicao-faixas", { numerator: 1, denominator: 2, at: "x", sourceRef: "x" }, none).state).toBe("sem-regra");
  });
  it("séries por período, só comparáveis, com tabela equivalente", () => {
    expect([periodKey("2026-03-10", "bimestral"), periodKey("2026-08-01", "semestral"), periodKey("2026-08-01", "anual")]).toEqual(["2026-B2", "2026-S2", "2026"]);
    const val = (n: number) => compute("acerto-bruto", { numerator: n, denominator: 100, at: "x", sourceRef: "x" }, none);
    const s = series([{ date: "2025-10-01", indicatorVersion: 1, comparabilityKey: "m1", value: val(50) }, { date: "2026-10-01", indicatorVersion: 1, comparabilityKey: "m1", value: val(60) }, { date: "2026-10-01", indicatorVersion: 1, comparabilityKey: "m2", value: val(90) }], "anual", { indicatorVersion: 1, comparabilityKey: "m1" });
    expect(s.rows.map(r => r.value)).toEqual([0.5, 0.6]);
    expect(s.notes[0]).toMatch(/1 ponto/);
    const c = explainChart(s, AA_INDICATORS.find(d => d.key === "acerto-bruto")!);
    expect(c.table[1]).toMatchObject({ período: "2026", valor: "60%" });
    expect(c.limitations).toContain("não é proficiência");
  });
});
