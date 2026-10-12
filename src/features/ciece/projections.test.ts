import { describe, expect, it } from "vitest";
import { projectDemand, projectClasses, projectTeachers, scenarioRecord } from "./projections";

const H = [2022, 2023, 2024, 2025].map((y, i) => ({ year: y, value: 100 + 10 * i, source: `censo-${y}` }));

describe("CIECE L16 projeções", () => {
  it("demanda: histórico suficiente, sempre rotulada como projeção com faixa", () => {
    const p = projectDemand(H, [2026, 2027]);
    expect(p.nature).toBe("projecao");
    if (p.nature !== "projecao") return;
    expect(p.official).toBe(false);
    expect(p.result[0]).toEqual({ year: 2026, central: 140, low: 140, high: 140 });
    expect(p.premises).toHaveLength(4);
  });
  it("demanda recusa histórico curto, com lacuna ou nulo, e horizonte passado", () => {
    expect(projectDemand(H.slice(0, 2), [2026])).toMatchObject({ nature: "recusada" });
    expect(projectDemand([H[0]!, H[2]!, H[3]!], [2026])).toMatchObject({ reasons: ["historico-com-lacuna"] });
    expect(projectDemand([...H.slice(0, 3), { year: 2025, value: null, source: "x" }], [2026]).nature).toBe("projecao");
    expect(projectDemand(H, [2024])).toMatchObject({ reasons: ["horizonte-nao-futuro"] });
  });
  it("turmas exigem capacidade declarada e turmas lidas", () => {
    const d = { low: 50, central: 61, high: 70 };
    expect(projectClasses(d, 2, null)).toMatchObject({ reasons: ["capacidade-por-turma-nao-declarada"] });
    expect(projectClasses(d, null, { key: "cap", value: 25, source: "usuario", ref: "u" })).toMatchObject({ reasons: ["turmas-atuais-nao-lidas"] });
    const p = projectClasses(d, 2, { key: "cap", value: 25, source: "usuario", ref: "u" });
    expect(p).toMatchObject({ result: { needed: { low: 2, central: 3, high: 3 }, open: 1, close: 0 } });
  });
  it("professores: matriz válida, carga contratual declarada, unidades compatíveis", () => {
    const m = { id: "mat-v3", valid: true, weeklyUnits: 25, unit: "aula" };
    const cl = { key: "carga", value: 20, source: "usuario" as const, ref: "u", unit: "aula" };
    expect(projectTeachers({ classes: 4, matrix: { ...m, valid: false }, contractualLoad: cl })).toMatchObject({ reasons: ["matriz-nao-vigente-ou-nao-homologada"] });
    expect(projectTeachers({ classes: 4, matrix: m, contractualLoad: null })).toMatchObject({ reasons: ["carga-contratual-nao-declarada"] });
    expect(projectTeachers({ classes: 4, matrix: m, contractualLoad: { ...cl, unit: "hora" } })).toMatchObject({ reasons: ["unidades-incompativeis(sem-regra-de-conversao)"] });
    const p = projectTeachers({ classes: 4, matrix: m, extraUnitsPerClass: { key: "ampliacao", value: 5, source: "usuario", ref: "u" }, contractualLoad: cl });
    expect(p).toMatchObject({ nature: "projecao", result: { demandUnits: 120, teachers: 6 } });
  });
  it("cenário nunca é publicável nem de uso oficial", () => {
    const s = scenarioRecord({ id: "c1", author: "u", createdAt: "t", projections: [projectDemand(H, [2026]), projectClasses({ low: 1, central: 1, high: 1 }, 1, null)] });
    expect(s).toMatchObject({ publishable: false, officialUse: "proibido", status: "com-recusas" });
  });
});
