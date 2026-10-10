import { describe, it, expect } from "vitest";
import { variantProjection, type InstrumentVersion, type ItemVersion } from "./authoring-model";
const items = new Map(["a","b","c","d","e"].map((id) => [id, { id, item_type_id: "objetiva", stem: id, options: [{ key: "A", text: "1" }, { key: "B", text: "2" }, { key: "C", text: "3" }] } as unknown as ItemVersion]));
const ins = { id: "v1", instrument_id: "i", version: 1, items: ["a","b","c","d","e"], randomization: null, title: "P", instructions: "" } as unknown as InstrumentVersion;
describe("versões embaralhadas da prova", () => {
  it("recusa sem aprovação da OP", () => { expect(variantProjection(ins, items, "A", false).ok).toBe(false); });
  it("original não exige aprovação", () => { expect(variantProjection(ins, items, null, false).ok).toBe(true); });
  it("mesma letra é determinística e letras diferentes mantêm as mesmas questões", () => {
    const a1 = variantProjection(ins, items, "A", true), a2 = variantProjection(ins, items, "A", true), b = variantProjection(ins, items, "B", true);
    if (!a1.ok || !a2.ok || !b.ok) throw new Error("x");
    expect(a1.p.questions.map((q) => q.itemVersionId)).toEqual(a2.p.questions.map((q) => q.itemVersionId));
    expect([...b.p.questions.map((q) => q.itemVersionId)].sort()).toEqual(["a","b","c","d","e"]);
  });
  it("letra inválida é recusada", () => { expect(variantProjection(ins, items, "Z", true).ok).toBe(false); });
});
