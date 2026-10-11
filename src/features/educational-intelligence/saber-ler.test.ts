import { describe, expect, it } from "vitest";
import { bandOf, entryState, isHomologated, roundSummary, score, trajectory, validateInstrumentDraft, type SlEntry, type SlInstrument } from "./saber-ler";

const inst: SlInstrument = { id: "i4", logical_id: "L", version: 1, edition_year: 2026, grade: 1, week: 4,
  items: [{ n: 1, axis: 1 }, { n: 2, axis: 1 }, { n: 3, axis: 2 }, { n: 4, axis: null }], writing_stages: ["E-A", "E-B"], percent_bands: null, source_ref: "doc", author_user_id: "a", recorded_at: "t" };
const e = (id: string, o: Partial<SlEntry>): SlEntry => ({ id, logical_id: id, version: 1, instrument_version_id: "i4", school_id: "A", class_id: "c", student_id: id,
  presence: "presente", participation: "participou", item_results: {}, writing_stage: null, author_user_id: "p", recorded_at: "t", ...o });

describe("Saber Ler", () => {
  it("instrumento: semana configurável, eixos 1–5 e itens únicos", () => {
    expect(validateInstrumentDraft({ week: 20, grade: 1, items: [{ n: 1, axis: 5 }], source: "doc" })).toEqual([]);
    expect(validateInstrumentDraft({ week: 0, grade: 3, items: [{ n: 1, axis: 6 }, { n: 1, axis: null }], source: "" }).length).toBe(5);
  });
  it("percentual exclui não aplicado e item sem registro; ausente não vira zero", () => {
    const s = score(e("s", { item_results: { "1": "acerto", "2": "erro", "3": "nao-aplicado" } }), inst.items);
    expect(s.pct).toBe(50); expect(s.missing).toBe(1);
    expect(score(e("s", { presence: "ausente" }), inst.items).pct).toBeNull();
    expect(score(e("s", { item_results: { "1": "acerto", "3": "erro" } }), inst.items, 1).pct).toBe(100);
  });
  it("faixa só com configuração; estágio separado", () => {
    expect(bandOf(80, null)).toBeNull();
    expect(bandOf(50, [{ label: "X", min: 0, max: 50 }, { label: "Y", min: 50, max: null }])).toBe("Y");
  });
  it("presença ≠ participação no resumo", () => {
    const r = roundSummary([e("a", {}), e("b", { participation: "nao-participou" }), e("c", { presence: "ausente", participation: null })], inst, []);
    expect(r).toMatchObject({ registered: 3, present: 2, absent: 1, participated: 1, notParticipated: 1, scored: 0, meanPct: null });
  });
  it("homologação e trajetória só com resultado homologado, ordenada por semana", () => {
    expect(isHomologated("i4", [{ instrument_version_id: "i4", decision: "homologado", recorded_at: "1" }, { instrument_version_id: "i4", decision: "revogado", recorded_at: "2" }])).toBe(false);
    const i8 = { ...inst, id: "i8", week: 8 };
    const es = [e("x1", { student_id: "s", item_results: { "1": "acerto" } }), { ...e("x2", { student_id: "s", item_results: { "1": "erro" } }), instrument_version_id: "i8" }];
    const rv = [{ entry_version_id: "x1", decision: "homologado" as const, recorded_at: "t" }];
    expect(entryState(es[1]!, rv)).toBe("rascunho");
    expect(trajectory("s", es, [inst, i8], rv).map((t) => t.week)).toEqual([4]);
    expect(trajectory("s", es, [inst, i8], rv, false).map((t) => t.week)).toEqual([4, 8]);
  });
});
