import { describe, expect, it } from "vitest";
import { paginate, QUICK_ACTIONS } from "./ciece-central";

describe("CIECE L19 central", () => {
  it("paginação estável de 20 e limites", () => {
    const rows = Array.from({ length: 55 }, (_, i) => i);
    expect(paginate(rows, 1)).toMatchObject({ page: 1, pages: 3 });
    expect(paginate(rows, 3).rows).toEqual([40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54]);
    expect(paginate(rows, 99).page).toBe(3);
    expect(paginate([], 1)).toMatchObject({ page: 1, pages: 1, rows: [] });
  });
  it("ações rápidas só apontam para telas existentes", () => {
    expect(QUICK_ACTIONS.map((a) => a.to)).toContain("/relatorios/personalizado");
  });
});
