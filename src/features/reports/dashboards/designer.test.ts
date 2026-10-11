import { describe, expect, it } from "vitest";
import { moveWidget, duplicateBoard, comparePeriods, spanOf, clampSpan, TEMPLATES, templateProblems, drillThroughSpec } from "./designer";
import type { Widget } from "./dashboard-store";
const w = (id: string, extra: Partial<Widget> = {}) => ({ id, title: id, kind: "bar", spec: { source: "x", joins: [], columns: [], groupBy: [], measures: [], filter: { op: "and", items: [] }, sort: [], subtotals: false, includeSensitive: false, labels: {} }, ...extra }) as Widget;
describe("designer", () => {
  it("arrastar move para a posição do alvo", () => {
    expect(moveWidget([w("a"), w("b"), w("c")], "a", "c").map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(moveWidget([w("a"), w("b")], "z", "a").map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("largura limitada a 1–3 e legado wide = 2", () => {
    expect(clampSpan(9)).toBe(3); expect(spanOf(w("a", { wide: true }))).toBe(2); expect(spanOf(w("a"))).toBe(1);
  });
  it("duplicar gera nome livre e novos ids", () => {
    let n = 0; const d = duplicateBoard({ widgets: [w("a")], filters: [] }, "P", ["P (cópia)"], () => `n${n++}`);
    expect(d.name).toBe("P (cópia 2)"); expect(d.board.widgets[0]!.id).toBe("n0");
  });
  it("comparação: ausente num período fica sem valor", () => {
    const r = comparePeriods([{ c1: "E1", c2: 3 }], [{ c1: "E1", c2: 5 }, { c1: "E2", c2: 1 }], "A", "B");
    expect(r).toEqual([{ categoria: "E1", A: 3, B: 5 }, { categoria: "E2", B: 1 }]);
  });
  it("drill-through vira consulta de linhas filtrada", () => {
    const s = drillThroughSpec(w("a").spec, ["x.a", "x.b"], { field: "x.a", operator: "eq", value: "E1" });
    expect(s.groupBy).toEqual([]); expect(s.columns).toEqual(["x.a", "x.b"]); expect(s.filter.items.length).toBe(2);
  });
  it("modelo com campo inexistente é recusado com motivo", () => {
    expect(templateProblems(TEMPLATES[0]!, { sources: {}, joins: [], gaps: [] })[0]).toMatch(/não existe/);
  });
  it("modelos não carregam dados", () => {
    for (const t of TEMPLATES) expect(JSON.stringify(t)).not.toMatch(/"rows"|"values"|"data"/);
  });
});
