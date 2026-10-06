import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { adhesion, competenceChecklist, consumptionLines, plannedVsExecuted, servedFacts } from "./execution-model";

const sql = readFileSync("drizzle/migrations/0186_nae5_meal_daily_execution.sql", "utf8");
const base = { deviation: null, meals_total: null, count_basis: null, students_present: null, students_present_source: null, planned_menu_ref: null };

describe("NAE.5 execução diária", () => {
  it("planejado ≠ executado: sem registro não é 'seguido'", () => {
    expect(plannedVsExecuted(null)).toBe("sem-registro");
    expect(plannedVsExecuted({ ...base, followed: null })).toBe("nao-informado");
    expect(plannedVsExecuted({ ...base, followed: false, deviation: "arroz" })).toBe("desvio");
  });
  it("refeições ≠ alunos e ausência ≠ zero", () => {
    const f = servedFacts({ ...base, followed: true, meals_total: 130, students_present: 100, students_present_source: "chamada" });
    expect(f.meals).toBe(130); expect(f.students).toBe(100);
    expect(f.mealsLabel).not.toMatch(/alunos atendidos/i);
    expect(servedFacts(null).meals).toBeNull();
  });
  it("adesão sem definição homologada fica indisponível mesmo com 130/100", () => {
    expect(adhesion(null)).toEqual({ state: "unavailable", code: "ADHESION_METRIC_PENDING" });
  });
  it("ficha técnica não cria saída; só consumo observado positivo vira linha", () => {
    expect(consumptionLines([])).toEqual([]);
    expect(consumptionLines([{ item: "a", unit: "kg", quantity: 2 }, { item: "b", unit: "kg", quantity: 0 }])).toHaveLength(1);
  });
  it("completude: área não lida = UNKNOWN", () => {
    const c = competenceChecklist({ pedidos: 0 });
    expect(c.find((x) => x.area === "pedidos")!.value).toBe(0);
    expect(c.find((x) => x.area === "inventario")!.value).toBe("UNKNOWN");
  });
  it("banco: desvio exige descrição, consumo uma vez por linha, correção de consumo só no estoque", () => {
    expect(sql).toMatch(/CHECK \(followed IS DISTINCT FROM false OR deviation IS NOT NULL\)/);
    expect(sql).toMatch(/movement_id uuid NOT NULL UNIQUE/);
    expect(sql).toMatch(/PRIMARY KEY \(execution_logical_id, line_key\)/);
    expect(sql).toMatch(/meal:consumption-correct-in-stock-ledger/);
    expect(sql).toMatch(/meal_grant_on\('registrar-execucao-alimentacao', _school, _on\)/);
    expect(sql).not.toMatch(/meal_menu_versions\s+SET|UPDATE public\.meal_menu/);
  });
});
