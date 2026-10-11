import { describe, expect, it } from "vitest";
import { bySkill, compatible, itemScore, textResult, validateInstrumentDraft, type LcEntry, type LcInstrument } from "./local-assessments";

const base = { round: "1", matrix: "matriz-v1", source: "doc", criteria: [], formula: null };
const inst = (o: Partial<LcInstrument>): LcInstrument => ({ id: "i", logical_id: "L", version: 1, program_key: "diagnostica", edition_year: 2026, round_label: "1", grade: "5", area: "MAT",
  matrix_ref: "m", items: [{ n: 1, ref_kind: "descritor", ref_code: "D1", scoring: "binario" }, { n: 2, ref_kind: "descritor", ref_code: "D1", scoring: "binario" }, { n: 3, ref_kind: "descritor", ref_code: "D2", scoring: "rubrica", max: 4 }],
  criteria: [], general_formula: null, source_ref: "d", author_user_id: "a", recorded_at: "t", ...o });
const ent = (id: string, o: Partial<LcEntry>): LcEntry => ({ id, logical_id: id, version: 1, instrument_version_id: "i", school_id: "A", class_id: "c", student_id: id, presence: "presente", results: {}, author_user_id: "p", recorded_at: "t", ...o });

describe("avaliações locais", () => {
  it("Simula SAEB só 4º/8º e com descritor", () => {
    expect(validateInstrumentDraft({ ...base, program: "simula-saeb", grade: "5", area: "LP", items: [{ n: 1, ref_kind: "bncc", ref_code: "EF05LP01", scoring: "binario" }] }).length).toBe(2);
    expect(validateInstrumentDraft({ ...base, program: "simula-saeb", grade: "8", area: "LP", items: [{ n: 1, ref_kind: "descritor", ref_code: "D3", scoring: "binario" }] })).toEqual([]);
  });
  it("rubrica exige máximo; BNCC malformado recusado", () => {
    expect(validateInstrumentDraft({ ...base, program: "formativa", grade: "TEC", area: "LP", items: [{ n: 1, ref_kind: "bncc", ref_code: "XX", scoring: "rubrica" }] }).length).toBe(2);
  });
  it("Produção Textual: 3 critérios; fórmula opcional mas com pesos e fonte", () => {
    const c = [{ key: "a", label: "A", max: 4 }, { key: "b", label: "B", max: 4 }, { key: "c", label: "C", max: 4 }];
    expect(validateInstrumentDraft({ ...base, program: "producao-textual", grade: "3", area: "LP", items: [], criteria: c.slice(0, 2) })).toContain("Produção Textual exige exatamente três critérios.");
    expect(validateInstrumentDraft({ ...base, program: "producao-textual", grade: "3", area: "LP", items: [], criteria: c, formula: { kind: "soma-ponderada", weights: { a: 1 }, source: "" } }).length).toBe(3);
    const pt = inst({ program_key: "producao-textual", items: [], criteria: c });
    expect(textResult(ent("x", { results: { a: 3, b: 2, c: 1 } }), pt).general).toBeNull();
    expect(textResult(ent("x", { results: { a: 3, b: 2, c: 1 } }), { ...pt, general_formula: { kind: "soma-ponderada", weights: { a: 1, b: 1, c: 2 }, source: "doc" } }).general).toBe(7);
    expect(textResult(ent("x", { results: { a: 3, b: 2 } }), { ...pt, general_formula: { kind: "soma-ponderada", weights: { a: 1, b: 1, c: 1 }, source: "doc" } }).general).toBeNull();
  });
  it("ausência ≠ zero; não aplicado fora do denominador", () => {
    const i = inst({});
    expect(itemScore(ent("a", { presence: "ausente" }), i.items).pct).toBeNull();
    expect(itemScore(ent("a", { results: { "1": 1, "2": "nao-aplicado", "3": 2 } }), i.items).pct).toBe(60);
    expect(itemScore(ent("a", { results: { "1": 0 } }), i.items).pct).toBe(0);
  });
  it("agrupamento por habilidade com faixa diagnóstica", () => {
    const s = bySkill([ent("a", { results: { "1": 1, "2": 1 } }), ent("b", { results: { "1": 0, "2": 1 } }), ent("c", { presence: "ausente" })], inst({}));
    expect(s.find((x) => x.code === "D1")).toMatchObject({ n: 2, mean: 75, band: "60-a-90" });
    expect(s.find((x) => x.code === "D2")).toMatchObject({ n: 0, mean: null });
  });
  it("comparação só compatível", () => {
    expect(compatible(inst({}), inst({ matrix_ref: "outra" })).ok).toBe(false);
    expect(compatible(inst({}), inst({ grade: "6" })).ok).toBe(false);
    expect(compatible(inst({}), inst({ id: "j" })).ok).toBe(true);
  });
});
