import { describe, it, expect } from "vitest";
import { recordProblems, dayFacts, suggestDebit, confirmDebit, debitKey, rectifyRecord, type DayRecord } from "./daily-production";

const r: DayRecord = { schoolId: "E1", date: "2026-03-02", meal: "almoço", plannedPreparationId: "p1", actualPreparationId: "p2", deviationNote: null,
  produced: 100, served: 90, leftoverKg: 2, wasteKg: null, occurrences: [], responsibleId: "m", responsibleIsPerson: true };
const recipe = { yieldPortions: 10, lines: [{ itemId: "arroz", gross: 1000, unit: "g" }] };

describe("produção diária", () => {
  it("desvio exige descrição; servidas ≤ produzidas", () => {
    expect(recordProblems(r)).toEqual(["desvio do cardápio exige descrição"]);
    expect(recordProblems({ ...r, deviationNote: "falta", served: 120 })).toEqual(["servidas maior que produzidas"]);
  });
  it("sem registro nada é inferido; resto não medido fica null", () => {
    expect(dayFacts(null).served).toBeNull();
    expect(dayFacts(r)).toMatchObject({ followed: "desvio", notServed: 10, wasteKg: null });
  });
  it("sugestão pela ficha e baixa só confirmada, sem duplicar", () => {
    expect(suggestDebit({ ...r, produced: null }, recipe).state).toBe("BLOCKED");
    const s = suggestDebit(r, recipe);
    if (s.state !== "SUGGESTED") throw new Error();
    expect(s.lines[0]!.qty).toBe(10000);
    expect(confirmDebit(s.lines, r, { confirmedBy: "m", isPerson: true, explicit: false }, new Set())).toHaveProperty("error");
    expect(confirmDebit(s.lines, r, { confirmedBy: "x", isPerson: false, explicit: true }, new Set())).toHaveProperty("error");
    expect(confirmDebit(s.lines, r, { confirmedBy: "m", isPerson: true, explicit: true }, new Set([debitKey(r, "arroz")]))).toEqual({ error: "baixa já realizada: arroz" });
    expect(confirmDebit(s.lines, r, { confirmedBy: "m", isPerson: true, explicit: true }, new Set())).toHaveProperty("moves");
  });
  it("retificação versiona com motivo e base esperada", () => {
    const h = [{ v: 1, record: { ...r, deviationNote: "x" }, reason: null, authorId: "m" }];
    expect(rectifyRecord(h, 0, h[0]!.record, "a", "m")).toHaveProperty("error");
    expect(rectifyRecord(h, 1, h[0]!.record, "", "m")).toHaveProperty("error");
    const n = rectifyRecord(h, 1, { ...h[0]!.record, served: 95 }, "contagem revista", "m");
    expect(Array.isArray(n) && n.length).toBe(2);
  });
});
