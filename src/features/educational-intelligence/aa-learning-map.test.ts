import { describe, it, expect } from "vitest";
import { mapLevel, heatmap, trend, canOpen, type MapRow, type Access } from "./aa-learning-map";

const r = (s: string, school: string, skill: string, correct: boolean | null, participated = true): MapRow => ({ editionId: "ed1", scaleKey: "local", matrixRef: "m1", schoolId: school, year: "5", classId: `${school}-t1`, component: "LP", skill, itemId: `${skill}-i1`, studentId: s, correct, participated });
const rows = [r("a", "e2", "H1", true), r("b", "e2", "H1", false), r("c", "e1", "H1", true), r("c", "e1", "H2", null), r("d", "e1", "H1", null, false)];
const net: Access = { network: true, schools: new Set(), nominal: { capability: false, purpose: null } };

describe("A&A L10 mapa de aprendizagem", () => {
  it("células por escola em ordem alfabética, sem zero presumido", () => {
    const m = mapLevel(rows, "escola", {}, net, null);
    if ("refused" in m) throw new Error();
    expect(m.cells.map(c => c.key)).toEqual(["e1", "e2"]);
    expect(m.cells[0]).toMatchObject({ nStudents: 2, nParticipants: 1, nAnswers: 1, rate: 1 });
    const h2 = mapLevel(rows, "habilidade", { escola: "e1" }, net, null);
    if ("refused" in h2) throw new Error();
    expect(h2.cells.find(c => c.key === "H2")?.rate).toBeNull();
  });
  it("supressão com política e alcance por escola", () => {
    const m = mapLevel(rows, "escola", {}, net, 2);
    if ("refused" in m) throw new Error();
    expect(m.cells.find(c => c.key === "e1")?.suppressed).toBe(true);
    const school: Access = { network: false, schools: new Set(["e1"]), nominal: { capability: false, purpose: null } };
    const s = mapLevel(rows, "turma", { escola: "e1" }, school, null);
    if ("refused" in s) throw new Error();
    expect(s.cells.map(c => c.key)).toEqual(["e1-t1"]);
    expect(mapLevel(rows, "turma", { escola: "e2" }, school, null)).toHaveProperty("refused");
  });
  it("nível estudante exige capability e finalidade; edições misturadas recusam", () => {
    expect(canOpen("estudante", {}, net).ok).toBe(false);
    expect(canOpen("estudante", {}, { ...net, nominal: { capability: true, purpose: "intervenção" } }).ok).toBe(true);
    expect(mapLevel([...rows, { ...rows[0]!, editionId: "ed2" }], "escola", {}, net, null)).toHaveProperty("refused");
  });
  it("heatmap e tendência só comparável", () => {
    const h = heatmap(rows, "escola", {}, net, null);
    if ("refused" in h) throw new Error();
    expect(h.skills).toEqual(["H1", "H2"]);
    expect(h.rows[1]!.cells[1]).toBeNull();
    const t = trend([{ editionId: "a", date: "2025", scaleKey: "local", matrixRef: "m1", rate: 0.5 }, { editionId: "b", date: "2026", scaleKey: "saeb", matrixRef: "m1", rate: 0.6 }], { scaleKey: "local", matrixRef: "m1" });
    expect(t.series).toHaveLength(1);
    expect(t.excluded[0]!.editionId).toBe("b");
  });
});
