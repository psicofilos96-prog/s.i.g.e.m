import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dashboardCounts, caseCentralRows, timelineOf } from "./permanence-hub-model";

const rows = [
  { id: "c1", schoolId: "s1", studentRef: "e1", openedAt: "2026-09-01T10:00:00Z" },
  { id: "c2", schoolId: "s1", studentRef: "e1", openedAt: "2026-10-01T10:00:00Z" },
];

describe("L23 tela da Permanência", () => {
  it("casos e estudantes únicos contam separado", () => {
    expect(dashboardCounts(rows)).toMatchObject({ cases: 2, students: 1, schools: 1, truncated: false });
  });
  it("central não expõe identificador do estudante", () => {
    expect(JSON.stringify(caseCentralRows(rows).map(({ row: _r, ...v }) => v))).not.toContain("e1");
  });
  it("linha do tempo cronológica e fonte negada marca parcial", () => {
    const t = timelineOf([{ id: "b", at: "2026-10-02", label: "x" }], [{ id: "a", at: "2026-10-01", label: "y" }]);
    expect(t.map((e) => e.id)).toEqual(["a", "b"]);
    expect(timelineOf([], null).partial).toBe(true);
  });
  it("página não lê antes da sessão nem grava diretamente", () => {
    const src = readFileSync("src/features/permanence/permanence-hub-page.tsx", "utf8");
    expect(src.indexOf('status === "signed-out"')).toBeLessThan(src.indexOf("<Hub"));
    expect(src).not.toMatch(/\.(insert|update|delete|upsert)\(/);
  });
});
