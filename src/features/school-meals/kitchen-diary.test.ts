import { describe, expect, it } from "vitest";
import { adhesion, diaryProblems, grossTotal, pvpsOrder } from "./kitchen-diary";

describe("Diário da Cozinha", () => {
  it("adesão nunca passa de 100% e não existe sem presentes", () => {
    expect(adhesion({ present: 100, first: 80, repeats: 30, staff: 5 })).toBe(80);
    expect(adhesion({ present: 10, first: 12, repeats: 0, staff: 0 })).toBe(100);
    expect(adhesion({ present: 0, first: 5, repeats: 0, staff: 0 })).toBeNull();
  });
  it("total bruto soma alunos, repetições e servidores", () => {
    expect(grossTotal({ present: 100, first: 80, repeats: 30, staff: 5 })).toBe(115);
    expect(grossTotal({ present: 100, first: 80, repeats: null, staff: 5 })).toBeNull();
  });
  it("parcialmente ou não exige motivo e cardápio servido", () => {
    expect(diaryProblems("parcialmente", "", "", { present: null, first: null, repeats: null, staff: null })).toHaveLength(2);
    expect(diaryProblems("sim", "", "", { present: null, first: null, repeats: null, staff: null })).toHaveLength(0);
  });
  it("PVPS: vence primeiro sai primeiro", () => {
    expect(pvpsOrder([{ expires_on: null }, { expires_on: "2027-05-01" }, { expires_on: "2027-03-01" }]).map((x) => x.expires_on)).toEqual(["2027-03-01", "2027-05-01", null]);
  });
});
