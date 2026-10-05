import { describe, expect, it } from "vitest";
import { applyItems, applyOperation, check, constraintsOf, diff, suggest, type Problem, type Slot } from "./optimizer-model";
import { executeBulk, previewBulk } from "@/features/bulk/bulk-engine";

const s = (id: string, wd = 1, start = "07:00", end = "07:50"): Slot => ({ id, weekday: wd, start, end });
const base = (over: Partial<Problem> = {}): Problem => ({ version: 1, snapshotKnownAt: "k", validOn: "2027-03-01",
  slotsByClass: { t1: [s("a", 1, "07:00", "07:50"), s("b", 1, "08:00", "08:50")], t2: [s("a2", 1, "07:00", "07:50"), s("b2", 1, "08:00", "08:50")] },
  lessons: [{ id: "l1", classId: "t1", componentId: "mat", personIds: ["p1"] }, { id: "l2", classId: "t2", componentId: "mat", personIds: ["p1"] }],
  availability: null, ...over });

describe("otimizador assistido", () => {
  it("conflito impossível é explicado e não gera candidato", () => {
    const o = suggest(base({ lessons: [1, 2, 3].map((i) => ({ id: `l${i}`, classId: "t1", componentId: "m", personIds: [] })) }));
    expect(o.candidates).toHaveLength(0); expect(o.impossible[0]!.message).toMatch(/3 blocos para 2/);
  });
  it("turma simultânea: mesma pessoa nunca em duas turmas no mesmo tempo", () => {
    const o = suggest(base());
    expect(o.candidates.length).toBeGreaterThan(0);
    for (const c of o.candidates) expect(check(base(), c.placements)).toEqual([]);
    expect(check(base(), [{ lessonId: "l1", slotId: "a" }, { lessonId: "l2", slotId: "a2" }])[0]!.constraint).toBe("pessoa-sem-simultaneidade");
  });
  it("múltiplas soluções distintas", () => {
    const o = suggest(base(), { max: 3 });
    expect(o.candidates.length).toBe(2);
    expect(new Set(o.candidates.map((c) => JSON.stringify(c.placements))).size).toBe(2);
  });
  it("constraint ausente aparece como não considerada, nunca presumida", () => {
    const c = constraintsOf(base());
    expect(c.find((x) => x.id === "disponibilidade-profissional")!.considered).toBe(false);
    expect(c.filter((x) => !x.considered).map((x) => x.id)).toEqual(expect.arrayContaining(["sala-ou-recurso", "carga-requerida-por-componente", "calendario-letivo"]));
  });
  it("professor indisponível", () => {
    const o = suggest(base({ availability: { p1: ["b", "a2"] } }));
    expect(o.candidates[0]!.placements).toEqual([{ lessonId: "l1", slotId: "b" }, { lessonId: "l2", slotId: "a2" }]);
    const none = suggest(base({ availability: { p1: [] } }));
    expect(none.candidates).toHaveLength(0); expect(none.impossible[0]!.constraint).toBe("disponibilidade-profissional");
  });
  it("determinismo", () => { expect(suggest(base())).toEqual(suggest(base())); });
  it("aplicação segura: nada aplica sem executor; com executor, só o diff e com base esperada", async () => {
    const p = base(); const c = suggest(p).candidates[0]!;
    const moves = diff(p, [{ lessonId: "l1", slotId: c.placements[0]!.slotId }], c);
    expect(moves.every((m) => m.lessonId !== "l1")).toBe(true);
    const items = applyItems(moves, "esc-a", "fp");
    const noExec = applyOperation(async () => "fp", null);
    expect(previewBulk(noExec, items, new Set(["esc-a"]), "L").ready).toBe(0);
    const calls: string[] = []; const op = applyOperation(async () => "fp", async (m) => { calls.push(m.lessonId); });
    const r = await executeBulk(op, items, previewBulk(op, items, new Set(["esc-a"]), "L"), { confirmed: true, completed: new Set() });
    expect(r.counts.executado).toBe(moves.length); expect(calls).toEqual(moves.map((m) => m.lessonId));
    const stale = applyOperation(async () => "outra", async () => {});
    const r2 = await executeBulk(stale, items, previewBulk(stale, items, new Set(["esc-a"]), "L"), { confirmed: true, completed: new Set() });
    expect(r2.counts.executado).toBe(0);
  });
});
