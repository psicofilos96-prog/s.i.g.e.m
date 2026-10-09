import { describe, expect, it } from "vitest";
import { STAGE_NEXT_STEP, cellValueText, groupByStructure } from "./map-structures";
import type { MapCell } from "./map-domain";

describe("NMAP.UX — zero versus ausência", () => {
  it("zero lido aparece como 0", () => { expect(cellValueText(0)).toBe("0"); });
  it("ausência nunca vira zero nem traço", () => {
    expect(cellValueText(null)).toBe("Não informado");
    expect(cellValueText(undefined)).toBe("Não informado");
    expect(cellValueText("")).toBe("Não informado");
  });
  it("booleano em linguagem comum", () => { expect(cellValueText(false)).toBe("Não"); });
});

describe("NMAP.UX — orientação", () => {
  it("toda etapa do envio tem próximo passo", () => {
    for (const k of ["rascunho", "enviado", "reenviado", "devolvido", "aprovado", "em-retificacao"] as const) expect(STAGE_NEXT_STEP[k].length).toBeGreaterThan(10);
  });
  it("índice tem as seis estruturas I–VI mesmo sem dados", () => {
    expect(groupByStructure([] as MapCell[]).map((g) => g.id)).toEqual(["I", "II", "III", "IV", "V", "VI"]);
  });
});
