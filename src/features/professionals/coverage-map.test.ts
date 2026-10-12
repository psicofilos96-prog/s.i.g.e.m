import { describe, expect, it } from "vitest";
import { bySchool, coverageMap, type BlockHolder, type CoverageBlock } from "./coverage-map";

const blk = (id: string, o: Partial<CoverageBlock> = {}): CoverageBlock => ({ blockId: id, schoolId: "E1", classId: "T1", componentId: "MAT", ...o });
const h = (blockId: string, source: BlockHolder["source"] = "atribuicao"): BlockHolder => ({ blockId, personId: "P1", source, ref: `${source}-${blockId}` });

describe("mapa de cobertura", () => {
  it("integral, parcial e ausente", () => {
    const cells = coverageMap([blk("B1"), blk("B2"), blk("C1", { componentId: "POR" }), blk("D1", { componentId: "CIE" })], [h("B1"), h("B2"), h("D1")], null)!;
    expect(cells.map((c) => [c.componentId, c.coverage])).toEqual([["CIE", "integral"], ["MAT", "integral"], ["POR", "ausente"]]);
    const p = coverageMap([blk("B1"), blk("B2")], [h("B1")], null)![0]!;
    expect(p).toMatchObject({ coverage: "parcial", uncovered: 1, uncoveredBlockIds: ["B2"] });
  });
  it("substituição cobre e é contada à parte", () => {
    const c = coverageMap([blk("B1"), blk("B2")], [h("B1"), h("B1", "substituicao"), h("B2")], null)![0]!;
    expect(c).toMatchObject({ coveredBySubstitution: 1, coveredByAssignment: 1, coverage: "integral" });
  });
  it("atribuições não lidas ⇒ indeterminada; grade não lida ⇒ null", () => {
    expect(coverageMap([blk("B1")], null, null)![0]!.coverage).toBe("indeterminada");
    expect(coverageMap(null, [], [])).toBeNull();
  });
  it("atribuída ≠ ministrada: execução só do Diário", () => {
    const noDiary = coverageMap([blk("B1")], [h("B1")], null)![0]!;
    expect(noDiary.execution).toEqual({ diaryRead: false, realized: null, notRealized: null, withoutRecord: null });
    const c = coverageMap([blk("B1"), blk("B2")], [h("B1"), h("B2")], [
      { blockId: "B1", date: "2026-03-02", situation: "Realizada" },
      { blockId: "B2", date: "2026-03-02", situation: "Prevista" },
      { blockId: "B1", date: "2026-03-09", situation: "Não realizada" },
    ])![0]!;
    expect(c.coverage).toBe("integral");
    expect(c.execution).toEqual({ diaryRead: true, realized: 1, notRealized: 1, withoutRecord: 1 });
  });
  it("resumo por escola só conta situações", () => {
    const cells = coverageMap([blk("B1"), blk("C1", { componentId: "POR" })], [h("B1")], null)!;
    expect(bySchool(cells).get("E1")).toEqual({ integral: 1, parcial: 0, ausente: 1, indeterminada: 0 });
  });
});
