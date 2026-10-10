import { describe, expect, it } from "vitest";
import { finalizeLines, proposeCorrection, type VariantMap } from "./variant-key";

const map: VariantMap = { instrumentVersionId: "v", variant: "B", entries: [
  { number: 1, itemVersionId: "i1", displayToKey: { A: "B", B: "A" }, keyToDisplay: { B: "A", A: "B" } },
  { number: 2, itemVersionId: "i2", displayToKey: {}, keyToDisplay: {} },
  { number: 3, itemVersionId: "i3", displayToKey: { A: "A", B: "B" }, keyToDisplay: { A: "A", B: "B" } },
] };
const keys = new Map([["i1", "B"], ["i3", "A"]]);

describe("correção SIA com revisão humana", () => {
  it("resposta da versão volta ao gabarito canônico", () => {
    const p = proposeCorrection(map, keys, { 1: "A", 2: null, 3: "B" });
    expect(p.lines.map((l) => l.correct)).toEqual([true, null, false]);
  });
  it("discursiva/sem gabarito bloqueia até decisão humana", () => {
    const p = proposeCorrection(map, keys, { 1: "A", 2: null, 3: "B" });
    expect(finalizeLines(p.lines, {})).toEqual({ ok: false, pending: [2] });
    const f = finalizeLines(p.lines, { 2: true });
    expect(f.ok && f.hits).toBe(2);
  });
  it("em branco nunca vira erro sem decisão", () => {
    const p = proposeCorrection(map, keys, { 1: null, 2: null, 3: "A" });
    expect(finalizeLines(p.lines, { 2: false }).ok).toBe(false);
  });
});
