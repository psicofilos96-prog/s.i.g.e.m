import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { networkSchools } from "./supervision-network";
import type { ReconRow } from "@/features/reports/cross-reports";

const fact = (school_id: string, measure: string, n: number | null): ReconRow => ({ school_id, measure, inep: "99999901", operational_value: n, official_value: n });
describe("Authorized network consultation", () => {
  it("never includes a school outside the authorized catalogue", () => {
    const rows = networkSchools([{ id: "a", name: "Escola A" }], [fact("b", "turmas", 7)]);
    expect(rows.map((r) => r.id)).toEqual(["a"]);
    expect(rows[0].classes).toBeNull();
  });
  it("preserves missing data and explicit zero distinctly", () => {
    const rows = networkSchools([{ id: "a", name: "A" }, { id: "b", name: "B" }], [fact("a", "turmas", 0)]);
    expect(rows[0].classes).toBe(0);
    expect(rows[0].enrollments).toBeNull();
    expect(rows[1].classes).toBeNull();
    expect(rows[1].comparison).toBeNull();
  });
  it("keeps enrollment links distinct from students without inferring totals", () => {
    const [row] = networkSchools([{ id: "a", name: "A" }], [fact("a", "turmas", 2), fact("a", "matriculas_total", 30), fact("a", "alunos", 25)]);
    expect(row.classes).toBe(2); expect(row.enrollments).toBe(30); expect(row.students).toBe(25);
  });
  it("matches immutable school IDs, not identical names", () => {
    const rows = networkSchools([{ id: "a", name: "Mesmo nome" }, { id: "b", name: "Mesmo nome" }], [fact("a", "turmas", 3)]);
    expect(rows[0].classes).toBe(3); expect(rows[1].classes).toBeNull();
  });
});