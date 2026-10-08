import { describe, expect, it } from "vitest";
import { paginate, stableSort } from "./list-paging";
import { toggleVisibleSelection } from "@/components/sigem/data-grid";

describe("NPAG.1 — paginação, ordenação e seleção", () => {
  const rows = Array.from({ length: 12_345 }, (_, i) => ({ id: `id-${String(i).padStart(5, "0")}`, name: i % 3 ? `Turma ${i % 100}` : "Mesmo nome" }));
  it("grande volume: todas as linhas aparecem uma única vez ao percorrer as páginas", () => {
    const sorted = stableSort(rows, (r) => r.name, (r) => r.id); const seen = new Set<string>();
    const first = paginate(sorted, 1, 50);
    for (let p = 1; p <= first.pageCount; p++) for (const r of paginate(sorted, p, 50).items) seen.add(r.id);
    expect(seen.size).toBe(12_345); expect(first.pageCount).toBe(247); expect(first.total).toBe(12_345);
  });
  it("ordenação estável: empates desempatam pelo id, sempre igual", () => {
    const a = stableSort(rows, (r) => r.name, (r) => r.id).map((r) => r.id);
    const b = stableSort([...rows].reverse(), (r) => r.name, (r) => r.id).map((r) => r.id);
    expect(a).toEqual(b);
  });
  it("página fora do intervalo vira a válida mais próxima; contagem honesta", () => {
    expect(paginate(rows, 999, 50).page).toBe(247);
    expect(paginate([], 3, 50)).toMatchObject({ page: 1, pageCount: 1, total: 0, from: 0, to: 0 });
    expect(paginate(rows, 1, 50, { limit: 12_345 }).truncated).toBe(true);
  });
  it("selecionar/desmarcar todos da página não atravessa outras páginas", () => {
    expect(toggleVisibleSelection(["x"], ["a", "b"], true)).toEqual(["x", "a", "b"]);
    expect(toggleVisibleSelection(["x", "a", "b"], ["a", "b"], false)).toEqual(["x"]);
  });
});
