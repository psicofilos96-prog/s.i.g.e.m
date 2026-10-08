import { describe, expect, it } from "vitest";
import { countLabel, formatCompetence, formatNumber, formatPercent, formatRatioPercent, joinList, MONTH_NAMES, MONTH_NAMES_LOWER, plural } from "./format-ptbr";
import { formatDateTime } from "./academic-date";

// Espaço do Intl pode variar; normaliza só para comparar.
const n = (s: string) => s.replace(/\u00a0|\u202f/g, " ");

describe("NFORMAT.1 — números", () => {
  it("milhar com ponto e decimal com vírgula", () => {
    expect(formatNumber(1234567.891)).toBe("1.234.567,89");
    expect(formatNumber(0.5)).toBe("0,5");
    expect(formatNumber(1000, { maxDecimals: 0 })).toBe("1.000");
    expect(formatNumber(2, { minDecimals: 2, maxDecimals: 2 })).toBe("2,00");
  });
  it("ausente nunca vira zero", () => {
    for (const v of [null, undefined, NaN, Infinity]) expect(formatNumber(v as number)).toBe("—");
    expect(formatRatioPercent(null)).toBe("—");
  });
  it("zero negativo exibido como 0", () => expect(formatNumber(-0.001)).toBe("0"));
  it("percentuais", () => {
    expect(formatRatioPercent(0.25)).toBe("25%");
    expect(formatRatioPercent(0.12345)).toBe("12,3%");
    expect(formatRatioPercent(1)).toBe("100%");
    expect(formatRatioPercent(0)).toBe("0%");
    expect(formatPercent(99.95, 1)).toBe("100%");
    expect(formatPercent(33.333, 2)).toBe("33,33%");
  });
});

describe("NFORMAT.1 — contagem e pluralização", () => {
  it("1 singular; 0 e demais plural", () => {
    expect(countLabel(0, "aviso", "avisos")).toBe("0 avisos");
    expect(countLabel(1, "aviso", "avisos")).toBe("1 aviso");
    expect(countLabel(2, "aviso", "avisos")).toBe("2 avisos");
    expect(countLabel(12345, "linha", "linhas")).toBe("12.345 linhas");
    expect(plural(-1, "dia", "dias")).toBe("dia");
  });
  it("lista com 'e'", () => {
    expect(joinList([])).toBe(""); expect(joinList(["a"])).toBe("a");
    expect(joinList(["a", "b"])).toBe("a e b"); expect(joinList(["a", "b", "c"])).toBe("a, b e c");
  });
});

describe("NFORMAT.1 — meses e datas", () => {
  it("doze meses, uma fonte", () => {
    expect(MONTH_NAMES).toHaveLength(12); expect(MONTH_NAMES[2]).toBe("Março"); expect(MONTH_NAMES_LOWER[11]).toBe("dezembro");
  });
  it("competência e fronteiras de mês", () => {
    expect(formatCompetence(1, 2027)).toBe("janeiro/2027");
    expect(formatCompetence(12, 2026, "long")).toBe("dezembro de 2026");
    expect(formatCompetence(0, 2027)).toBe("—"); expect(formatCompetence(13, 2027)).toBe("—");
  });
  it("data e hora iguais em tela e PDF (Brasília, sem segundos)", () => {
    expect(n(formatDateTime("2027-01-01T02:59:00Z"))).toBe("31/12/2026 23:59");
    expect(n(formatDateTime("2027-01-01T03:00:00Z"))).toBe("01/01/2027 00:00");
    expect(formatDateTime(null)).toBe("");
  });
});
