import { describe, expect, it } from "vitest";
import { adhesionPct, parseCounts, servedMealsRows, servedMealsTotals } from "./served-meals-report";

const basis = "cardápio previsto: x; 1ª refeição a alunos: 90; repetições: 10; servidores: 5; amostra coletada e etiquetada: sim";

describe("Relatório PNAE de refeições", () => {
  it("lê as contagens gravadas pelo Diário", () => { expect(parseCounts(basis)).toEqual({ first: 90, repeats: 10, staff: 5 }); });
  it("contagem 'não informado' fica null, nunca zero", () => { expect(parseCounts("1ª refeição a alunos: não informado").first).toBeNull(); });
  it("adesão nunca passa de 100%", () => { expect(adhesionPct(120, 100)).toBe(100); expect(adhesionPct(90, 100)).toBe(90); });
  it("totais: adesão do período só com todos os lados informados", () => {
    const rows = servedMealsRows([
      { executed_on: "2027-03-01", meal_slot_value_id: "almoco", meals_total: 105, count_basis: basis, students_present: 100, followed: true },
      { executed_on: "2027-03-02", meal_slot_value_id: "almoco", meals_total: 50, count_basis: null, students_present: 60, followed: false },
    ], (v) => v);
    const t = servedMealsTotals(rows);
    expect(t.total.sum).toBe(155);
    expect(t.first.missing).toBe(1);
    expect(t.adhesion).toBeNull();
  });
});
