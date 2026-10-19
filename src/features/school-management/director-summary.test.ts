import { describe, expect, it } from "vitest";
import { mapStageLabel, vacancySummary } from "./director-summary";

describe("resumo da Direção", () => {
  it("separa turmas com vaga, lotadas, superlotadas e sem capacidade", () => {
    expect(vacancySummary([
      { class_id: "a", capacity: 30, occupancy: 20 }, { class_id: "b", capacity: 30, occupancy: 30 },
      { class_id: "c", capacity: 30, occupancy: 33 }, { class_id: "d", capacity: null, occupancy: 10 },
    ])).toEqual({ open: 1, full: 1, over: 1, unknown: 1, total: 4 });
  });
  it("leitura falha não vira zero", () => expect(vacancySummary(null)).toBeNull());
  it("mapa congelado prevalece; não aberto não vira rascunho", () => {
    expect(mapStageLabel("aprovado", true, true)).toBe("Fechado (congelado)");
    expect(mapStageLabel("rascunho", false, false)).toBe("Ainda não aberto");
    expect(mapStageLabel("xyz", true, false)).toBe("Situação não reconhecida");
  });
});
