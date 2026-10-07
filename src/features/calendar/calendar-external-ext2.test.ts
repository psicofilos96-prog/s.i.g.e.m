import { describe, expect, it } from "vitest";
import { defaultProfile, periodColumns, sanitizeProfile } from "./calendar-external-model";

describe("CAL.EXT.2 — períodos letivos e imagem de fundo", () => {
  it("grade automática quebra 4 bimestres em 2 colunas (nunca 4 numa linha estreita)", () => {
    expect(periodColumns(4, { cols: "auto", layout: "grade" })).toBe(2);
    expect(periodColumns(2, { cols: "auto", layout: "grade" })).toBe(2);
    expect(periodColumns(6, { cols: "auto", layout: "grade" })).toBe(3);
  });
  it("empilhado é sempre 1 coluna e número fixo não excede os períodos", () => {
    expect(periodColumns(4, { cols: 3, layout: "empilhado" })).toBe(1);
    expect(periodColumns(2, { cols: 4, layout: "grade" })).toBe(2);
    expect(periodColumns(3, { cols: "auto", layout: "horizontal" })).toBe(3);
  });
  it("Panorâmico nasce em grade; Mosaico em linha", () => {
    expect(defaultProfile("externo-panoramico").periods.layout).toBe("grade");
    expect(defaultProfile("externo-mosaico").periods.layout).toBe("horizontal");
  });
  it("valores inválidos voltam ao padrão; válidos são mantidos", () => {
    const p = sanitizeProfile("externo-panoramico", { coverFit: "esticar", periods: { cols: 9, layout: "grade", minHmm: 99, wrap: false }, coverFocusX: 130, infoWidths: { periodos: 50 } });
    expect(p.coverFit).toBe("manual");
    expect(p.periods.cols).toBe("auto");
    expect(p.periods.minHmm).toBe(30);
    expect(p.periods.wrap).toBe(false);
    expect(p.coverFocusX).toBe(100);
    expect(p.infoWidths.periodos).toBe(50);
  });
});
