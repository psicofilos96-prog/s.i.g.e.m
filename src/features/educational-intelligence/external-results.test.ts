import { describe, expect, it } from "vitest";
import { compareExt, historicalSeries, participationRate, validateExtResult, type ExtResult } from "./external-results";

const base: ExtResult = { id: "a", logical_id: "la", version: 1, program_key: "saeb", edition_year: 2023, stage: "5º ano", area: "LP",
  scope: "rede", school_id: null, sample_kind: "censitaria", scale_key: "saeb-lp-5", matrix_ref: "saeb-2001", expected_count: 100, present_count: 80,
  proficiency: 210, levels: null, flow_p: null, perf_n: null, ideb: null, target: null, source_ref: "INEP Resultados 2023", homologated: true };

describe("avaliações externas", () => {
  it("recusa acerto bruto como proficiência", () => expect(validateExtResult({ ...base, scale_key: "saeb-acertos" }).join()).toMatch(/Acerto bruto/));
  it("recusa escala de outro programa", () => expect(validateExtResult({ ...base, scale_key: "caed-lp" }).join()).toMatch(/incompatível/));
  it("IDEB deve ser N × P", () => {
    const i = { ...base, program_key: "ideb" as const, scale_key: "ideb-inep", proficiency: null, flow_p: 0.95, perf_n: 6, ideb: 5.7 };
    expect(validateExtResult(i)).toEqual([]);
    expect(validateExtResult({ ...i, ideb: 6.0 }).join()).toMatch(/N × P/);
  });
  it("participação sem denominador é null, não zero", () => expect(participationRate({ expected_count: null, present_count: 0 })).toBeNull());
  it("bloqueia matriz, escala e amostra incompatíveis", () => {
    expect(compareExt(base, { ...base, id: "b", edition_year: 2025, matrix_ref: "saeb-bncc" })).toEqual({ ok: false, reason: "Matrizes diferentes." });
    expect(compareExt(base, { ...base, id: "b", edition_year: 2025, sample_kind: "amostral" }).ok).toBe(false);
    expect(compareExt(base, { ...base, id: "b", edition_year: 2025 }).ok).toBe(true);
  });
  it("série usa só homologados e versão vigente", () => {
    const rows = [base, { ...base, id: "b1", logical_id: "lb", edition_year: 2025, proficiency: 200 }, { ...base, id: "b2", logical_id: "lb", version: 2, edition_year: 2025, proficiency: 215 },
      { ...base, id: "c", logical_id: "lc", edition_year: 2024, homologated: false }];
    const s = historicalSeries(rows, base);
    expect(s.included.map((r) => r.id)).toEqual(["a", "b2"]);
    expect(s.excluded[0].reason).toBe("Não homologado.");
  });
});
