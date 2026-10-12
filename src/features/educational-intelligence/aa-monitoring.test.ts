import { describe, it, expect } from "vitest";
import { transition, stateOf, actionsReport, alerts, evolution, type StateEvent, type Measure } from "./aa-monitoring";

const go = (e: StateEvent[], to: StateEvent["state"], reason: string | null = null) => { const r = transition(e, e.length, to, "p1", "2026-03-01", reason); if (!r.ok) throw new Error(r.reason); return [...e, r.event]; };

describe("A&A L14 monitoramento e reavaliação", () => {
  it("estados com justificativa e base esperada", () => {
    let e = go([], "planejada");
    e = go(e, "em-execucao");
    expect(transition(e, 2, "replanejada", "p1", "x", " ").ok).toBe(false);
    e = go(e, "replanejada", "estratégia não engajou");
    e = go(e, "em-execucao"); e = go(e, "aguardando-avaliacao"); e = go(e, "concluida");
    expect(stateOf(e)).toBe("concluida");
    expect(transition(e, 6, "em-execucao", "p1", "x", null).ok).toBe(false);
    expect(transition(e, 1, "concluida", "p1", "x", null).ok).toBe(false);
  });
  it("previstas × realizadas e alertas", () => {
    const actions = [{ id: "a1", planned: "x", due: "2026-03-10", doneAt: "2026-03-09", evidenceRefs: [] }, { id: "a2", planned: "y", due: "2026-03-10", doneAt: null, evidenceRefs: [] }, { id: "a3", planned: "z", due: null, doneAt: null, evidenceRefs: [] }];
    expect(actionsReport(actions, "2026-03-20")).toMatchObject({ planned: 3, done: 1, doneWithoutEvidence: ["a1"], late: ["a2"], withoutDue: ["a3"] });
    const k = alerts({ state: "aguardando-avaliacao", actions, today: "2026-03-20", reassessmentDue: "2026-03-15", reassessments: 0 }).map(a => a.kind);
    expect(k).toEqual(["acao-atrasada", "sem-evidencia", "reavaliacao-pendente"]);
  });
  it("evolução declara comparabilidade e não infere causa", () => {
    const base: Measure = { id: "b", planId: "pl", date: "2026-02", instrumentVersion: "i1", scaleKey: "s", skill: "H1", populationKey: "g1", n: 10, rate: 0.3 };
    const ev = evolution("pl", base, [{ ...base, id: "m1", date: "2026-04", instrumentVersion: "i2", rate: 0.5 }, { ...base, id: "m2", date: "2026-05", scaleKey: "t", rate: 0.9 }, { ...base, id: "m3", planId: "outro" }]);
    expect(ev.points[0]).toMatchObject({ comparable: true, differences: ["instrumento"] });
    expect(ev.points[0]!.delta).toBeCloseTo(0.2);
    expect(ev.points[1]).toMatchObject({ comparable: false, delta: null });
    expect(ev.notes.join()).toMatch(/não prova/);
  });
});
