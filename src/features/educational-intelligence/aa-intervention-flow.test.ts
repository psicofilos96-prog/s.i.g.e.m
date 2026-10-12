import { describe, it, expect } from "vitest";
import { advance, effectiveness, validatePlan, overdue, CAP, type Actor, type Event, type Plan } from "./aa-intervention-flow";

const cap = new Set([CAP]);
const aa: Actor = { personId: "aa1", role: "aa", capabilities: cap };
const prof: Actor = { personId: "p1", role: "docente", capabilities: cap };
const op: Actor = { personId: "o1", role: "orientacao", capabilities: cap };
const plan: Plan = { objective: "Ler textos curtos", skills: ["H1"], audience: { scope: "grupo", ref: "g1" }, strategies: ["leitura guiada"], responsibles: ["p1"], resources: [], due: "2026-05-01" };
const step = (ev: Event[], to: Event["stage"], actor: Actor, extra = {}) => { const r = advance({ events: ev, expectedSeq: ev.length, to, actor, at: "2026-03-01", note: "registro", plan, ...extra }); if (!r.ok) throw new Error(r.reason); return [...ev, r.event]; };

describe("A&A L13 planos de intervenção", () => {
  it("fluxo completo respeita autoria por etapa", () => {
    let ev: Event[] = [];
    ev = step(ev, "diagnostico", aa);
    ev = step(ev, "proposta", prof);
    expect(advance({ events: ev, expectedSeq: 2, to: "analise", actor: aa, at: "x", note: "n", plan }).ok).toBe(false); // A&A não usurpa OP
    ev = step(ev, "analise", op);
    expect(advance({ events: ev, expectedSeq: 3, to: "plano", actor: prof, at: "x", note: "n", plan }).ok).toBe(false); // sem análise aprovada
    ev = step(ev, "plano", prof, { analysisApproved: true });
    expect(advance({ events: ev, expectedSeq: 4, to: "execucao", actor: aa, at: "x", note: "n", plan }).ok).toBe(false); // A&A não executa
    ev = step(ev, "execucao", prof); ev = step(ev, "evidencia", prof); ev = step(ev, "monitoramento", aa);
    ev = step(ev, "reavaliacao", aa); ev = step(ev, "encerrado", op);
    expect(ev.at(-1)!.stage).toBe("encerrado");
  });
  it("base esperada, capability e plano completo", () => {
    expect(advance({ events: [], expectedSeq: 1, to: "diagnostico", actor: aa, at: "x", note: "n", plan }).ok).toBe(false);
    expect(advance({ events: [], expectedSeq: 0, to: "diagnostico", actor: { ...aa, capabilities: new Set() }, at: "x", note: "n", plan }).ok).toBe(false);
    expect(validatePlan({ ...plan, skills: [], due: null })).toEqual(["habilidades", "prazo"]);
    expect(overdue(plan, "execucao", "2026-06-01")).toBe(true);
  });
  it("efetividade só comparável e sem causalidade", () => {
    expect(effectiveness({ scaleKey: "a", skill: "H1", rate: 0.3 }, { scaleKey: "b", skill: "H1", rate: 0.6 }, null).state).toBe("nao-comparavel");
    expect(effectiveness({ scaleKey: "a", skill: "H1", rate: 0.3 }, { scaleKey: "a", skill: "H1", rate: 0.6 }, null).state).toBe("descrito");
    expect(effectiveness({ scaleKey: "a", skill: "H1", rate: 0.3 }, { scaleKey: "a", skill: "H1", rate: 0.35 }, { value: 0.1, ruleRef: "r" }).state).toBe("nao-atingiu-criterio");
  });
});
