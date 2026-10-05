import { describe, expect, it } from "vitest";
import { addChange, applyChanges, compare, createScenario, fingerprintBase, isStale, memoryStore, promotionItems, promotionOperation } from "./scenario-model";
import { executeBulk, previewBulk } from "@/features/bulk/bulk-engine";
import type { ClassInput } from "@/features/staffing/staffing-model";

const base = (): ClassInput[] => [
  { classId: "t1", label: "T1", blocks: [{ blockKey: "x1", componentId: "mat", minutes: 50, engagementIds: [], usable: true }, { blockKey: "x2", componentId: "mat", minutes: 50, engagementIds: [], usable: true }], assignments: [] },
  { classId: "t2", label: "T2", blocks: [], assignments: [] },
];
const mk = (b = base()) => createScenario({ id: "s1", authorUserId: "u1", schoolId: "esc-a", validOn: "2027-03-01", knownAt: "2027-03-01T00:00:00Z", label: "Teste", base: b });

describe("simulador de cenários", () => {
  it("isolamento absoluto: aplicar alterações nunca muda a base real nem a base do cenário", () => {
    const real = base(); const frozen = JSON.stringify(real);
    let s = mk(real); s = addChange(s, { kind: "grade:remover-bloco", classId: "t1", blockKey: "x1" });
    const sim = applyChanges(s.base, s.changes);
    expect(sim[0]!.blocks).toHaveLength(1); expect(JSON.stringify(real)).toBe(frozen); expect(s.base[0]!.blocks).toHaveLength(2);
    expect(s.mode).toBe("simulacao");
  });
  it("baseline muda após a criação: cenário fica stale e preserva sua base", () => {
    const real = base(); const s = mk(real);
    real[0]!.blocks!.push({ blockKey: "x3", componentId: "mat", minutes: 50, engagementIds: [], usable: true });
    expect(s.base[0]!.blocks).toHaveLength(2); expect(isStale(s, real)).toBe(true); expect(isStale(s, base())).toBe(false); expect(isStale(s, null)).toBeNull();
  });
  it("comparação baseline × cenário (reorganização de turma e distribuição de regência)", () => {
    let s = mk(); s = addChange(s, { kind: "turma:mover-blocos", fromClassId: "t1", toClassId: "t2", blockKeys: ["x2"] });
    s = addChange(s, { kind: "grade:trocar-responsavel", classId: "t2", blockKey: "x2", engagementIds: ["e1"] });
    s = addChange(s, { kind: "regencia:adicionar", classId: "t2", assignment: { assignmentId: "h1", componentId: "mat", engagementId: "e1", personId: "p1", vigente: true } });
    const c = compare(s);
    expect(c.delta).toEqual({ lessons: 0, demandMinutes: 0, uncoveredMinutes: -50 }); expect(c.scenarioPeople).toBe(1);
  });
  it("promoção parcial: só alterações com executor canônico passam; demais recusadas com a tela oficial", async () => {
    let s = mk(); s = addChange(s, { kind: "grade:remover-bloco", classId: "t1", blockKey: "x1" });
    s = addChange(s, { kind: "regencia:remover", classId: "t1", assignmentId: "zz" });
    const calls: string[] = [];
    const op = promotionOperation(async () => s.baseFingerprint, { record_class_schedule_version: async (_p, k) => { calls.push(k); } });
    const items = promotionItems(s); const pv = previewBulk(op, items, new Set(["esc-a"]), "L");
    const r = await executeBulk(op, items, pv, { confirmed: true, completed: new Set() });
    expect(r.rows.map((x) => x.outcome)).toEqual(["executado", "recusado"]); expect(r.rows[1]!.reason).toMatch(/\/turmas/); expect(calls).toHaveLength(1);
  });
  it("promoção de cenário stale e sem permissão de escopo é recusada", async () => {
    let s = mk(); s = addChange(s, { kind: "grade:remover-bloco", classId: "t1", blockKey: "x1" });
    const exec = { record_class_schedule_version: async () => {} };
    const items = promotionItems(s);
    expect(previewBulk(promotionOperation(async () => s.baseFingerprint, exec), items, new Set(["esc-b"]), "L").ready).toBe(0);
    const op = promotionOperation(async () => "outra-base", exec);
    const r = await executeBulk(op, items, previewBulk(op, items, new Set(["esc-a"]), "L"), { confirmed: true, completed: new Set() });
    expect(r.rows[0]!.outcome).toBe("recusado"); expect(r.rows[0]!.reason).toMatch(/alterado/);
  });
  it("excluir cenário não toca fatos e cenários são por autor", () => {
    const real = base(); const before = fingerprintBase(real);
    const st = memoryStore(); const s = mk(real); st.save(s); st.save({ ...s, id: "s2", authorUserId: "u2" });
    expect(st.list("u1")).toHaveLength(1); st.remove("u1", "s1");
    expect(st.list("u1")).toHaveLength(0); expect(st.list("u2")).toHaveLength(1); expect(fingerprintBase(real)).toBe(before);
  });
  it("estimativa sem base legível falha explicitamente", () => {
    const s = mk([{ classId: "t1", label: null, blocks: null, assignments: null }]);
    expect(() => applyChanges(s.base, [{ kind: "grade:remover-bloco", classId: "t1", blockKey: "x" }])).toThrow(/não foi lida/);
  });
});
