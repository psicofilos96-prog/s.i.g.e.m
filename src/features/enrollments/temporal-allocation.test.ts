import { describe, expect, it } from "vitest";
import { allocationHistory, planAllocation, type AllocActor, type AllocContext } from "./temporal-allocation";

const actor: AllocActor = { personId: "p", isHuman: true, capabilities: ["enturmar"], requiredCapability: "enturmar" };
const pol = { maxConcurrentPerParticipation: 1 };
const iv = { from: "2027-02-01", to: "2027-12-15" };
const ctx: AllocContext = {
  enrollment: { participationId: "part", interval: { from: "2027-02-01", to: "2027-12-20" }, active: true },
  classInfo: { classId: "T2", activeInterval: { from: "2027-01-01", to: "2027-12-31" }, compositionPositions: ["ano-3"] },
  studentPosition: "ano-3", authorizedCapacity: 2, occupantsOnDate: ["x"], existing: [],
};

describe("Enturmação temporal L13", () => {
  it("plano válido vai ao writer canônico, sem gravar", () => {
    const r = planAllocation({ classId: "T2", interval: iv }, ctx, pol, actor);
    expect(r).toEqual({ ok: true, plan: [{ writer: "record_class_allocation", participationId: "part", classId: "T2", interval: iv }] });
  });
  it("etapa incompatível, posição não lida, turma inativa, matrícula fora de vigência", () => {
    expect(planAllocation({ classId: "T2", interval: iv }, { ...ctx, studentPosition: "ano-5" }, pol, actor).ok).toBe(false);
    expect(planAllocation({ classId: "T2", interval: iv }, { ...ctx, studentPosition: undefined }, pol, actor).ok).toBe(false);
    expect(planAllocation({ classId: "T2", interval: { from: "2027-02-01", to: null } }, ctx, pol, actor).ok).toBe(false);
    expect(planAllocation({ classId: "T2", interval: { from: "2027-01-15", to: "2027-06-01" } }, ctx, pol, actor).ok).toBe(false);
  });
  it("capacidade: cheia recusa, ausente recusa, o próprio estudante não conta duas vezes", () => {
    expect(planAllocation({ classId: "T2", interval: iv }, { ...ctx, occupantsOnDate: ["x", "y"] }, pol, actor).ok).toBe(false);
    expect(planAllocation({ classId: "T2", interval: iv }, { ...ctx, authorizedCapacity: null }, pol, actor).ok).toBe(false);
    expect(planAllocation({ classId: "T2", interval: iv }, { ...ctx, occupantsOnDate: ["x", "part"] }, pol, actor).ok).toBe(true);
  });
  it("sobreposição recusada; mudança de turma encerra origem na véspera em plano único", () => {
    const existing = [{ id: "a1", participationId: "part", classId: "T1", interval: { from: "2027-02-01", to: null } }];
    expect(planAllocation({ classId: "T2", interval: { from: "2027-05-10", to: "2027-12-15" } }, { ...ctx, existing }, pol, actor).ok).toBe(false);
    const r = planAllocation({ classId: "T2", interval: { from: "2027-05-10", to: "2027-12-15" }, moveFromAllocationId: "a1" }, { ...ctx, existing }, pol, actor);
    expect(r.ok && r.plan[0]).toEqual({ writer: "end_class_allocation", allocationId: "a1", endOn: "2027-05-09" });
    expect(planAllocation({ classId: "T1", interval: iv, moveFromAllocationId: "a1" }, { ...ctx, existing }, pol, actor).ok).toBe(false);
  });
  it("sem política de cardinalidade, executor técnico ou leituras ausentes ⇒ recusa; histórico ordenado", () => {
    expect(planAllocation({ classId: "T2", interval: iv }, ctx, { maxConcurrentPerParticipation: null }, actor).ok).toBe(false);
    expect(planAllocation({ classId: "T2", interval: iv }, ctx, pol, { ...actor, isTechnicalExecutor: true }).ok).toBe(false);
    expect(planAllocation({ classId: "T2", interval: iv }, { ...ctx, existing: null }, pol, actor).ok).toBe(false);
    const h = allocationHistory([
      { id: "b", participationId: "part", classId: "T2", interval: { from: "2027-05-10", to: null } },
      { id: "a", participationId: "part", classId: "T1", interval: { from: "2027-02-01", to: "2027-05-09" } },
    ], "part");
    expect(h.map((x) => x.classId)).toEqual(["T1", "T2"]);
  });
});
