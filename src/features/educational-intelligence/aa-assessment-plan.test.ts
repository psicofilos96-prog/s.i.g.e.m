import { describe, expect, it } from "vitest";
import { planProblems, editorProblems, moveSlot, addSlot, setPoints, totalPoints, nextVersion, bookletLayout, bookletAnswerKey, type EditorVersion, type PlanVersion } from "./aa-assessment-plan";
import type { BankMeta, ReviewEvent } from "./aa-item-bank";

const plan: PlanVersion = { planId: "p", version: 1, supersedes: null, editionId: "e", objective: "Diagnóstico", audience: { stage: "EF", year: "2", components: ["LP"] }, skillRefIds: ["EF02LP01"],
  instrumentKind: "impresso", schedule: [{ step: "aplicação", on: "2026-11-03", sourceDoc: null }, { step: "correção", on: "2026-11-10", sourceDoc: null }], criteria: "acertos", responsibles: [{ engagementId: "g", role: "coordenação" }], authorPersonId: "a", recordedAt: "t" };
const ev = (id: string): ReviewEvent => ({ itemId: id, versionId: id, seq: 1, to: "aprovado", actorPersonId: "r", reason: null, at: "t" });
const meta = (id: string): BankMeta => ({ itemId: id, versionId: id, source: "s", rights: { holder: "h", license: "l", allowsReuse: true, allowsAdaptation: false }, skillRefIds: ["x"], complexity: null, maxPoints: 1, rubric: null, attachments: [] });
const ed: EditorVersion = { instrumentId: "ins", version: 1, supersedes: null, planId: "p", title: "T", instructions: "", mode: "impresso", appliedOn: null, authorPersonId: "a",
  slots: [{ itemVersionId: "q1", points: 1, section: null }, { itemVersionId: "q2", points: 2, section: null }, { itemVersionId: "q3", points: 1, section: null }],
  booklets: [{ letter: "A", seed: "", shuffleItems: false, shuffleOptions: false }, { letter: "B", seed: "s1", shuffleItems: true, shuffleOptions: true }], adaptations: [] };
const bank = { events: ["q1", "q2", "q3"].map(ev), meta: new Map(["q1", "q2", "q3"].map((i) => [i, meta(i)])) };

describe("A&A Lote 05 planejamento e editor", () => {
  it("plano exige objetivo, público, habilidade, critérios, responsável e cronograma em ordem", () => {
    expect(planProblems(plan)).toEqual([]);
    expect(planProblems({ ...plan, responsibles: [], schedule: [...plan.schedule].reverse() })).toEqual(["responsável (atuação) obrigatório", "cronograma fora de ordem"]);
  });
  it("editor: ordenar, pontuar; pontuação ausente bloqueia total; item não aprovado e adaptação não aprovada impedem", () => {
    expect(moveSlot(ed.slots, 2, 0).map((s) => s.itemVersionId)).toEqual(["q3", "q1", "q2"]);
    expect(addSlot(ed.slots, "q1")).toHaveLength(3);
    expect(totalPoints(ed.slots)).toBe(4); expect(totalPoints(setPoints(ed.slots, 0, null))).toBeNull();
    expect(editorProblems(ed, bank)).toEqual([]);
    const bad = { ...ed, booklets: [{ letter: "A", seed: "", shuffleItems: true, shuffleOptions: false }], adaptations: [{ id: "x", kind: "ampliada", description: "", requestedBy: "a", approvedBy: "a" }] };
    expect(editorProblems(bad, { ...bank, events: [] })).toEqual(expect.arrayContaining(["item q1 não aprovado no banco", "caderno A: embaralhar exige semente declarada", "adaptação ampliada: aprovador deve ser distinto do solicitante"]));
  });
  it("versão aplicada é imutável; base esperada obrigatória", () => {
    expect(nextVersion(ed, 0, ed)).toMatchObject({ ok: false, reason: /base/ });
    expect(nextVersion({ ...ed, appliedOn: "2026-11-03" }, 1, ed)).toMatchObject({ ok: false, reason: /imutável/ });
    expect(nextVersion(ed, 1, ed)).toMatchObject({ ok: true, version: { version: 2, supersedes: "ins@1" } });
  });
  it("cadernos determinísticos; gabarito por caderno só com capacidade e segue a permutação", () => {
    const opts = new Map(["q1", "q2", "q3"].map((i) => [i, ["A", "B", "C", "D"]]));
    const b1 = bookletLayout(ed, "B", opts, new Set())!; expect(bookletLayout(ed, "B", opts, new Set())).toEqual(b1);
    expect(bookletLayout(ed, "A", opts, new Set())!.map((q) => q.itemVersionId)).toEqual(["q1", "q2", "q3"]);
    expect(bookletAnswerKey(b1, new Map([["q1", "B"]]), new Set())).toHaveProperty("refused");
    const k = bookletAnswerKey(b1, new Map([["q1", "B"]]), new Set(["ver-gabarito-avaliacao-institucional"])) as { lines: { number: number; key: string | null }[] };
    const q1 = b1.find((q) => q.itemVersionId === "q1")!;
    expect(k.lines.find((l) => l.number === q1.number)!.key).toBe("ABCD"[q1.optionOrder!.indexOf("B")]);
    expect(bookletLayout({ ...ed, slots: setPoints(ed.slots, 0, null) }, "A", opts, new Set())).toBeNull();
  });
});
