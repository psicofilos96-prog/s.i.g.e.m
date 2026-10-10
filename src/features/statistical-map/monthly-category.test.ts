import { describe, it, expect } from "vitest";
import { networkMonthByCategory, type MonthlyRow } from "./monthly-map-2026";
import { classifySchool } from "./declared-inconsistencies";
const row = (id: string, status: MonthlyRow["status"], n: number | null) => ({ school_id: id, inep: null, school_name: id, reference_date: "2026-09-30", earliest_evidence: null, status, snapshot_bonds: null, dated_bonds: null, snapshot_date: null, coverage_pct: null,
  distinct_students: n, school_enrollments: n, undated_enrollments: n, bonds: n, regular_bonds: n, aee_bonds: n, aee_students: n, aee_only_students: n, classes_with_students: n, entries_in_month: n, exits_in_month: n }) as MonthlyRow;
describe("consolidado mensal por categoria", () => {
  const cls = new Map([["u", classifySchool({ location_kind: "urbana", administrative_dependency: "municipal" })], ["r", classifySchool({ location_kind: "rural", administrative_dependency: "municipal" })],
    ["cr", classifySchool({ location_kind: "rural", administrative_dependency: "privada" })]]);
  const g = (rows: MonthlyRow[]) => Object.fromEntries(networkMonthByCategory(rows, cls).map((c) => [c.key, c.net]));
  it("conveniada rural conta em conveniada e zona rural", () => {
    const r = g([row("u", "apurado", 10), row("r", "apurado", 5), row("cr", "apurado", 3)]);
    expect(r["conveniada"].totals.bonds).toBe(3); expect(r["rural"].totals.bonds).toBe(8); expect(r["municipal-rural"].totals.bonds).toBe(5); expect(r["rede"].totals.bonds).toBe(18);
  });
  it("escola sem classificação fica em linha própria", () => {
    expect(g([row("x", "apurado", 1)])["nao-classificada"].schools).toBe(1);
  });
  it("estimativa parcial nunca deixa a categoria completa", () => {
    expect(g([row("u", "estimativa-parcial", 10)])["municipal-urbana"].complete).toBe(false);
  });
});
