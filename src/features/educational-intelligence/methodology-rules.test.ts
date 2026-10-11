import { describe, expect, it } from "vitest";
import { canCompare, diagnosticBand, infrequencyAlert, infrequencyMode, textProductionReady, validateMeasure, validateSaberLer } from "./methodology-rules";

describe("regras metodológicas A&A", () => {
  it("SAEB não aceita acertos", () => { expect(validateMeasure("saeb-ideb", "acertos-locais").length).toBe(1); expect(validateMeasure("saeb-ideb", "indice-nxp")).toEqual([]); });
  it("faixas diagnósticas com 90 exato na última", () => {
    expect(diagnosticBand(49.9)).toBe("abaixo-50"); expect(diagnosticBand(50)).toBe("50-a-60");
    expect(diagnosticBand(60)).toBe("60-a-90"); expect(diagnosticBand(90)).toBe("90-ou-mais"); expect(diagnosticBand(null)).toBeNull();
  });
  it("Saber Ler semanas e eixos", () => {
    expect(validateSaberLer({ week: 8, axis: 3 })).toEqual([]);
    expect(validateSaberLer({ week: 6, axis: 6, axisName: "Fluência" }).length).toBe(3);
  });
  it("Produção Textual exige configuração validada", () => {
    expect(textProductionReady(null).ok).toBe(false);
    expect(textProductionReady({ thresholdPct: 90, formula: "x", validatedBy: null, source: "doc" }).ok).toBe(false);
  });
  it("infrequência estritamente <75 e 2º período acumulado", () => {
    expect(infrequencyAlert(75)).toBe(false); expect(infrequencyAlert(74.99)).toBe(true); expect(infrequencyAlert(null)).toBe(false);
    expect(infrequencyMode(2)).toBe("acumulado");
  });
  it("comparação bloqueada entre escalas/matrizes", () => {
    expect(canCompare({ programKey: "saeb-ideb", matrixKey: "m" }, { programKey: "cnca-caed", matrixKey: "m" }).ok).toBe(false);
    expect(canCompare({ programKey: "simula-saeb", matrixKey: "a" }, { programKey: "simula-saeb", matrixKey: "b" }).ok).toBe(false);
    expect(canCompare({ programKey: "simula-saeb", matrixKey: "a" }, { programKey: "simula-saeb", matrixKey: "a" }).ok).toBe(true);
    expect(canCompare({ programKey: "saber-ler", matrixKey: "a" }, { programKey: "saber-ler", matrixKey: "a" }).ok).toBe(false);
  });
});
