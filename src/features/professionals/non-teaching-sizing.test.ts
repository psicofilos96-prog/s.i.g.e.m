import { describe, expect, it } from "vitest";
import { sizeArea, validateCriterion, type SizingCriterion } from "./non-teaching-sizing";

const D = "2026-03-02";
const cr = (o: Partial<SizingCriterion> = {}): SizingCriterion => ({ id: "C1", area: "secretaria", version: 1, formula: { type: "por-unidade", driver: "matriculas", perUnits: 300, minimum: 1, rounding: "cima" }, basis: "Decisão do proprietário 2026-10", validFrom: "2026-01-01", validUntil: null, homologated: true, scope: "rede", ...o });
const drv = (m: Record<string, number>) => (n: string) => m[n] ?? null;

describe("dimensionamento não docente", () => {
  it("sem critério homologado não há número", () => {
    expect(sizeArea("E1", "secretaria", D, [], drv({}), 2)).toMatchObject({ state: "sem-criterio", reference: null });
    expect(sizeArea("E1", "secretaria", D, [cr({ homologated: false })], drv({ matriculas: 500 }), 2).state).toBe("sem-criterio");
    expect(sizeArea("E1", "alimentacao", D, [cr()], drv({ matriculas: 500 }), 2).state).toBe("sem-criterio");
  });
  it("por unidade com arredondamento e mínimo; diferença com quadro lido", () => {
    expect(sizeArea("E1", "secretaria", D, [cr()], drv({ matriculas: 650 }), 2)).toMatchObject({ state: "calculado", reference: 3, difference: -1, criterionRef: "C1@1", driverValue: 650 });
    expect(sizeArea("E1", "secretaria", D, [cr()], drv({ matriculas: 10 }), 1).reference).toBe(1);
  });
  it("por faixa e fixo", () => {
    const faixa = cr({ formula: { type: "por-faixa", driver: "turmas", bands: [{ upTo: 10, quantity: 1 }, { upTo: 20, quantity: 2 }, { upTo: null, quantity: 3 }] } });
    expect(sizeArea("E1", "secretaria", D, [faixa], drv({ turmas: 15 }), null)).toMatchObject({ reference: 2, state: "quadro-nao-lido", difference: null });
    expect(sizeArea("E1", "direcao", D, [cr({ area: "direcao", formula: { type: "fixo", quantity: 1 } })], drv({}), 1).difference).toBe(0);
  });
  it("driver ausente nunca vira zero", () => {
    expect(sizeArea("E1", "secretaria", D, [cr()], drv({}), 2)).toMatchObject({ state: "driver-ausente", reference: null });
  });
  it("escola prevalece sobre rede; duas da mesma camada são ambíguas", () => {
    const esc = cr({ id: "C2", scope: ["E1"], formula: { type: "fixo", quantity: 4 } });
    expect(sizeArea("E1", "secretaria", D, [cr(), esc], drv({ matriculas: 300 }), 4).reference).toBe(4);
    expect(sizeArea("E1", "secretaria", D, [cr(), cr({ id: "C3" })], drv({ matriculas: 300 }), 1).state).toBe("criterio-ambiguo");
  });
  it("critério homologado exige fundamento; faixas inválidas são recusadas", () => {
    expect(validateCriterion(cr({ basis: null }))).toContain("sem-fundamento");
    expect(validateCriterion(cr({ formula: { type: "por-faixa", driver: "t", bands: [{ upTo: 20, quantity: 1 }, { upTo: 10, quantity: 2 }, { upTo: null, quantity: 3 }] } }))).toContain("faixas-invalidas");
    expect(sizeArea("E1", "secretaria", D, [cr({ basis: null })], drv({ matriculas: 300 }), 1).state).toBe("sem-criterio");
  });
});
