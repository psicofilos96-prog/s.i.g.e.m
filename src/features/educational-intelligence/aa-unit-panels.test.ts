import { describe, it, expect } from "vitest";
import { unitPanel, proposeGroup, groupStatus, compareSchools, type StudentResult } from "./aa-unit-panels";

const s = (id: string, rate: number | null, part = true, eligible = true): StudentResult => ({ studentId: id, unitId: "t1", eligible, participated: part, rate, skillRates: { H1: rate, H2: 0.9 } });
const rows = [s("a", 0.2), s("b", 0.8), s("c", null, false), s("d", 0.5, true, false)];

describe("A&A L12 painéis de turma e escola", () => {
  it("elegíveis/participantes, faixa só homologada, evolução mesma escala", () => {
    const p = unitPanel({ unitId: "t1", rows, bandRule: null, minN: null, plans: [], history: [{ editionId: "x", date: "2025", scaleKey: "local", rate: 0.4 }, { editionId: "y", date: "2026", scaleKey: "saeb", rate: 0.7 }], scaleKey: "local" });
    expect(p).toMatchObject({ eligible: 3, participants: 2, distribution: null });
    expect(p.participation).toBeCloseTo(2 / 3);
    expect(p.evolution).toHaveLength(1);
    expect(p.lowestSkills[0]!.skill).toBe("H1");
    const h = unitPanel({ unitId: "t1", rows, bandRule: { ruleRef: "r", version: 1, homologated: true, bands: [{ label: "A", min: 0, max: 50 }, { label: "B", min: 50.01, max: 100 }] }, minN: null, plans: [], history: [], scaleKey: "local" });
    expect(h.distribution).toEqual({ A: 1, B: 1 });
    expect(unitPanel({ unitId: "t1", rows, bandRule: null, minN: 5, plans: [], history: [], scaleKey: "local" }).lowestSkills).toEqual([]);
  });
  it("grupo temporário exige critério, revisão e nome neutro", () => {
    expect(proposeGroup({ id: "g", skill: "H1", criterion: null, rows, today: "2026-03-01", reviewDays: 30, name: "H1" })).toHaveProperty("refused");
    expect(proposeGroup({ id: "g", skill: "H1", criterion: { max: 0.5, ruleRef: "r" }, rows, today: "2026-03-01", reviewDays: 0, name: "H1" })).toHaveProperty("refused");
    expect(proposeGroup({ id: "g", skill: "H1", criterion: { max: 0.5, ruleRef: "r" }, rows, today: "2026-03-01", reviewDays: 30, name: "Alunos fracos" })).toHaveProperty("refused");
    const g = proposeGroup({ id: "g", skill: "H1", criterion: { max: 0.5, ruleRef: "r" }, rows, today: "2026-03-01", reviewDays: 30, name: "Oficina H1" });
    if ("refused" in g) throw new Error();
    expect(g.members).toEqual(["a"]);
    expect(groupStatus(g, "2026-04-15")).toBe("revisao-vencida");
  });
  it("comparação contextualizada sem ranking", () => {
    expect(compareSchools([{ schoolId: "b", instrumentVersion: "1", eligible: 10, participants: 9, rate: 0.9, population: "x" }, { schoolId: "a", instrumentVersion: "2", eligible: 1, participants: 1, rate: 1, population: null }], 0.8)).toHaveProperty("refused");
    const c = compareSchools([{ schoolId: "b", instrumentVersion: "1", eligible: 10, participants: 9, rate: 0.9, population: "x" }, { schoolId: "a", instrumentVersion: "1", eligible: 10, participants: 5, rate: 0.95, population: null }], 0.8);
    if ("refused" in c) throw new Error();
    expect(c.rows!.map(r => r.schoolId)).toEqual(["a", "b"]);
    expect(c.rows![0]!.caveats.length).toBe(2);
  });
});
