import { describe, expect, it } from "vitest";
import { compareDeclared, movementBalance, type DeclaredMap } from "./declared-monthly-map";

const base: DeclaredMap = {
  school_id: "s", month: 7, source_file: "f", source_sheet: "JULHO 2026",
  previous_month_enrollment: 71, transfers_in: 0, new_students: 1, transfers_out: 0, dropouts: 0, withdrawn_cancelled: 0,
  total_ii: 72, declared_classes: 7, total_iii: 72, classes: [], consistency_issues: [],
};

describe("mapa mensal declarado", () => {
  it("fecha a movimentação do mês", () => expect(movementBalance(base)).toBe(72));
  it("parcela ausente não vira zero", () => expect(movementBalance({ ...base, dropouts: null })).toBeNull());
  it("compara declarado com SIGEM sem inventar", () => {
    const c = compareDeclared(base, { distinct_students: 70, classes_with_students: 7 });
    expect(c.map((x) => x.status)).toEqual(["diverge", "coincide"]);
    expect(compareDeclared(base, undefined).every((x) => x.status === "indisponivel")).toBe(true);
  });
});
