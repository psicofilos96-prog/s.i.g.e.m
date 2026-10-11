import { describe, expect, it } from "vitest";
import { MATRIX_FAMILIES, validateMatrixRow, duplicateCodes, validateRelation, skillMastery, coverageGaps, interventionCandidates, type MatrixRow, type Response } from "./matrix-skills";

const H = "a".repeat(64);
const row = (o: Partial<MatrixRow> = {}): MatrixRow => ({ family: "cnca-caed", code: "C01", text: "Ler palavras", component: "LP leitura", grade: "2º", bnccCodes: ["EF12LP01"], cycles: ["I", "II"], ...o });

describe("matrizes", () => {
  it("7 famílias, nenhuma com conteúdo carregado", () => { expect(MATRIX_FAMILIES).toHaveLength(7); expect(MATRIX_FAMILIES.every((m) => !m.contentLoaded)).toBe(true); });
  it("linha CNCA válida", () => expect(validateMatrixRow(row(), H)).toEqual([]));
  it("sem hash da fonte é recusada", () => expect(validateMatrixRow(row(), null)).toContain("fonte-nao-verificada"));
  it("CNCA exige ciclos válidos", () => {
    expect(validateMatrixRow(row({ cycles: [] }), H)).toContain("ciclos-ausentes");
    expect(validateMatrixRow(row({ cycles: ["IV"] }), H)).toContain("ciclo-invalido");
  });
  it("ciclo em matriz sem ciclos é recusado", () => expect(validateMatrixRow(row({ family: "saeb-classica", component: "LP", cycles: ["I"], bnccCodes: [] }), H)).toContain("ciclo-nao-se-aplica"));
  it("código BNCC malformado", () => expect(validateMatrixRow(row({ bnccCodes: ["EF1LP"] }), H)).toContain("bncc-invalido"));
  it("código preserva zeros e não aceita espaço", () => expect(validateMatrixRow(row({ code: " 007" }), H)).toContain("codigo-com-espaco"));
  it("duplicidade por família", () => expect(duplicateCodes([row(), row(), row({ family: "bncc" })])).toEqual(["cnca-caed|C01"]));
  it("equivalência sem fonte oficial é recusada", () => {
    expect(validateRelation({ from: "a", to: "b", nature: "equivalente-declarada", confidence: "editorial", sourceRef: null })).toContain("equivalencia-sem-fonte");
    expect(validateRelation({ from: "a", to: "b", nature: "relacionada", confidence: "editorial", sourceRef: null })).toEqual([]);
  });
});

describe("domínio por habilidade", () => {
  const links = [{ itemId: "q1", skillRef: "H1" }, { itemId: "q2", skillRef: "H1" }, { itemId: "q3", skillRef: "H2" }];
  const rs: Response[] = [
    { itemId: "q1", studentId: "a", state: "certa" }, { itemId: "q2", studentId: "a", state: "errada" },
    { itemId: "q1", studentId: "b", state: "certa" }, { itemId: "q2", studentId: "b", state: "nao-lida" },
    { itemId: "q3", studentId: "a", state: "certa" },
  ];
  it("sem regra homologada não calcula taxa", () => expect(skillMastery(links, rs, null).every((m) => m.rate === null && m.status === "sem-regra")).toBe(true));
  it("não lida fica fora do denominador e é contada", () => {
    const h1 = skillMastery(links, rs, { minItemsPerSkill: 2, minRespondents: 2 })[0]!;
    expect(h1).toMatchObject({ status: "apurado", correct: 2, valid: 3, excluded: 1 });
    expect(h1.rate).toBeCloseTo(2 / 3);
  });
  it("poucos itens ou respondentes não apura", () => {
    const m = skillMastery(links, rs, { minItemsPerSkill: 2, minRespondents: 2 });
    expect(m[1]!.status).toBe("itens-insuficientes");
    expect(skillMastery(links, rs, { minItemsPerSkill: 1, minRespondents: 3 })[0]!.status).toBe("respondentes-insuficientes");
  });
  it("lacuna de cobertura", () => expect(coverageGaps(["H1", "H2", "H3"], links)).toEqual(["H3"]));
  it("intervenção exige limiar", () => {
    const m = skillMastery(links, rs, { minItemsPerSkill: 2, minRespondents: 2 });
    expect(interventionCandidates(m, null).ok).toBe(false);
    expect(interventionCandidates(m, 0.7)).toEqual({ ok: true, skills: ["H1"] });
  });
});
