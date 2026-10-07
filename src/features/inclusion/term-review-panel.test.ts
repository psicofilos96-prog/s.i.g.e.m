import { describe, expect, it } from "vitest";
import { filterTerms, groupTerms, termMessage, type TermRow } from "./term-review-panel";

const r = (seq: number, status: TermRow["status"]): TermRow => ({ term_logical_id: "t", seq, original_term: "TEA", origin: "ficha", status, alias: null, category_value_id: null, note: null, recorded_at: "2026-10-07" });

describe("tela da fila de termos", () => {
  it("estado vigente é o último evento", () => {
    const g = groupTerms([r(2, "validado"), r(1, "pendente")]);
    expect(g[0]!.head.status).toBe("validado"); expect(g[0]!.history).toHaveLength(2);
  });
  it("sem permissão atribuída vira ASSIGNMENT_PENDING, não erro", () => {
    expect(termMessage("inclusion:capability-missing")).toBe("ASSIGNMENT_PENDING");
  });
  it("filtro usa o estado vigente", () => {
    const g = groupTerms([r(1, "pendente"), r(2, "recusado")]);
    expect(filterTerms(g, "pendente")).toHaveLength(0);
    expect(filterTerms(g, "recusado")).toHaveLength(1);
  });
});
