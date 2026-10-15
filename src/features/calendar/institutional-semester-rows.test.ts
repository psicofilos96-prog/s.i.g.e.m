import { describe, expect, it } from "vitest";
import { gridRows } from "./institutional-calendar-print";

const presentation = {
  year: 2027,
  periodGroups: [
    { id: "s1", name: "1º", order: 1, totalLabel: "TOTAL DO 1° SEMESTRE" },
    { id: "s2", name: "2º", order: 2, totalLabel: "TOTAL DO 2° SEMESTRE" },
  ],
  periods: [
    { id: "a", groupId: "s1", start: "2027-02-04", end: "2027-07-09" },
    { id: "b", groupId: "s2", start: "2027-07-26", end: "2027-12-21" },
  ],
};
const months = Array.from({ length: 12 }, (_, i) => {
  const key = `2027-${String(i + 1).padStart(2, "0")}`;
  const n = new Date(Date.UTC(2027, i + 1, 0)).getUTCDate();
  const days = Array.from({ length: n }, (_, d) => ({ on: `${key}-${String(d + 1).padStart(2, "0")}`, label: null, typeLabel: null, symbolCode: null, extraCodes: [], effect: "letivo" as const, markMismatch: false }));
  return { key, days, total: { schoolDays: n, reason: null } };
});
const model = { title: "x", months, periods: [], total: { schoolDays: 0, reason: null }, signatures: [], unmappedTypes: [], holidays: [], legendCodes: [], mismatches: [] };

describe("interno com semestres", () => {
  it("julho aparece nos dois semestres, dividido no início do 2º semestre (26/07)", () => {
    const rows = gridRows(model as never, presentation, 2027);
    const julys = rows.filter((r) => r.kind === "mes" && r.month.key === "2027-07");
    expect(julys.map((r) => r.kind === "mes" && [r.from, r.to])).toEqual([["2027-01-01", "2027-07-25"], ["2027-07-26", "2027-12-31"]]);
    expect(rows.filter((r) => r.kind === "total").map((r) => r.kind === "total" && r.label)).toEqual(["TOTAL DO 1° SEMESTRE", "TOTAL DO 2° SEMESTRE"]);
  });
  it("sem grupos, 12 meses seguidos", () => {
    expect(gridRows(model as never, { year: 2027 }, 2027).length).toBe(12);
  });
});
