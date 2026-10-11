import { describe, expect, it } from "vitest";
import { blankOptions, headerProblems, itemProblems, parseEntries, richBlocks, variantAnswerKey, weightSummary } from "./sia-editor";
import { printProjection, variantProjection, type InstrumentVersion, type ItemVersion } from "./authoring-model";

const opt = (n: number) => blankOptions(`objetiva-${n}`).map((o) => ({ ...o, text: `t${o.key}` }));
describe("SIA editor", () => {
  it("objetiva 4 exige 4 alternativas e gabarito único", () => {
    expect(itemProblems("objetiva-4", "x", opt(4), "B")).toEqual([]);
    expect(itemProblems("objetiva-4", "x", opt(5), "B")).toContain("Este tipo exige exatamente 4 alternativas.");
    expect(itemProblems("objetiva-5", "x", opt(5), "A,B")).toContain("Informe exatamente uma alternativa correta (gabarito único).");
    expect(itemProblems("objetiva-5", "x", opt(5), "Z")).toContain("A alternativa correta não existe entre as alternativas.");
  });
  it("V/F aceita só V ou F", () => {
    expect(itemProblems("verdadeiro-falso", "x", blankOptions("verdadeiro-falso"), "F")).toEqual([]);
    expect(itemProblems("verdadeiro-falso", "x", blankOptions("verdadeiro-falso"), "X").length).toBe(1);
  });
  it("tabela e equação viram blocos, sem HTML", () => {
    const b = richBlocks("Veja:\n| a | b |\n|---|---|\n| 1 | 2 |\n$$x^2+1$$\nSe $y=2$ então <b>");
    expect(b.map((x) => x.kind)).toEqual(["p", "table", "eq", "p"]);
    expect((b[1] as any).rows).toEqual([["a", "b"], ["1", "2"]]);
    expect((b[3] as any).parts).toEqual([{ kind: "text", text: "Se " }, { kind: "eq", text: "y=2" }, { kind: "text", text: " então <b>" }]);
  });
  it("peso ausente não vira zero e total só com todos declarados", () => {
    expect(weightSummary(parseEntries([{ item_version_id: "a", weight: 2 }, { item_version_id: "b" }]))).toEqual({ declared: 1, missing: 1, total: null });
    expect(weightSummary(parseEntries([{ item_version_id: "a", weight: 2 }, { item_version_id: "b", weight: 3.5 }])).total).toBe(5.5);
  });
  it("cabeçalho exige nomes AV únicos", () => {
    expect(headerProblems({ labels: ["AV1", "AV1"], logos: [] })).toContain("Nomes de avaliação repetidos.");
    expect(headerProblems({ labels: ["AV1"], logos: ["outro"] })).toContain("Logo fora da lista permitida.");
  });
  it("versões embaralhadas são determinísticas e o gabarito acompanha a letra", () => {
    const mk = (id: string, t = "objetiva-4"): ItemVersion => ({ id, item_id: id, version: 1, supersedes_id: null, item_type_id: t, stem: id, options: t === "verdadeiro-falso" ? blankOptions(t) : opt(4), curricular_refs: [], school_id: "s", visibility: "pessoal", status: "publicado", key_shared: false, copied_from_version_id: null, author_user_id: "u", recorded_at: "" });
    const items = new Map(["i1", "i2", "i3"].map((i) => [i, mk(i)])); items.set("vf", mk("vf", "verdadeiro-falso"));
    const ins = { id: "v1", instrument_id: "x", version: 1, supersedes_id: null, assignment_id: "a", class_id: "c", school_id: "s", period_id: null, title: "T", instructions: null, items: [...items.keys()].map((k) => ({ item_version_id: k })), randomization: null, status: "publicado", results_instrument_id: null, author_user_id: "u", recorded_at: "" } as InstrumentVersion;
    expect(variantProjection(ins, items, "A", false).ok).toBe(false);
    const a1 = variantProjection(ins, items, "A", true), a2 = variantProjection(ins, items, "A", true), b = variantProjection(ins, items, "B", true);
    expect(JSON.stringify(a1)).toBe(JSON.stringify(a2));
    expect(JSON.stringify((a1 as any).p.questions)).not.toBe(JSON.stringify((b as any).p.questions));
    const vfq = (a1 as any).p.questions.find((q: any) => q.itemVersionId === "vf"); expect(vfq.options.map((o: any) => o.key)).toEqual(["V", "F"]);
    const keys = new Map([["i1", "C"], ["i2", "A"], ["i3", "D"], ["vf", "F"]]);
    for (const q of (a1 as any).p.questions) {
      const k = variantAnswerKey([q], keys)[0]!; const shown = q.options.length === 2 ? q.options.find((o: any) => o.key === k.display) : q.options["ABCD".indexOf(k.display)];
      expect(shown.key).toBe(keys.get(q.itemVersionId));
    }
    expect(printProjection(ins, items).questions.map((q) => q.itemVersionId)).toEqual(["i1", "i2", "i3", "vf"]);
  });
});
