import { describe, expect, it } from "vitest";
import { compareSeries, compareTemporal, type AssessmentVersion, type MetricValue, type MetricVersion } from "./performance-model";

const metric = (f = { op: "media" } as const): MetricVersion => ({ id: "m", logical_id: "m", version: 1, event_kind: "constituicao", label: "M", assessment_logical_id: "a", formula: f, population_key: "p", unit_label: null, source_note: "s", recorded_at: "" });
const asm: AssessmentVersion = { id: "a", logical_id: "a", version: 1, event_kind: "constituicao", title: "A", origin: "institucional", source_note: null, applied_from: "", applied_to: "", target_population: [{ axis_id: "x", value_id: "1" }], items: [], scale: { kind: "numerico", min: 0, max: 10 }, recorded_at: "" };
const v = (value: number): MetricValue => ({ status: "calculada", value, base: 10, absent: 0, notApplied: 0, resultIds: [] });
const none: MetricValue = { status: "sem-base", reason: "x", absent: 0, notApplied: 0, resultIds: [] };

describe("Evolução da avaliação", () => {
  it("diferença absoluta e percentual: 5 → 6 = +1 e +20%", () => {
    const c = compareTemporal({ metric: metric(), assessment: asm, value: v(5) }, { metric: metric(), assessment: asm, value: v(6) });
    expect(c).toMatchObject({ comparable: true, delta: 1, deltaPercent: 20 });
  });
  it("base anterior zero: percentual indefinido, nunca infinito", () => {
    const c = compareTemporal({ metric: metric(), assessment: asm, value: v(0) }, { metric: metric(), assessment: asm, value: v(3) });
    expect(c).toMatchObject({ comparable: true, delta: 3, deltaPercent: null });
  });
  it("valor sem base não vira zero na comparação", () => {
    const c = compareTemporal({ metric: metric(), assessment: asm, value: none }, { metric: metric(), assessment: asm, value: v(3) });
    expect(c).toMatchObject({ comparable: true, delta: null, deltaPercent: null });
  });
  it("série rompe no passo com fórmula diferente", () => {
    const s = compareSeries([
      { metric: metric(), assessment: asm, value: v(4) },
      { metric: metric(), assessment: asm, value: v(5) },
      { metric: metric({ op: "contagem-observados" } as never), assessment: asm, value: v(9) },
    ]);
    expect(s[0]).toMatchObject({ comparable: true, delta: 1 });
    expect(s[1]).toMatchObject({ comparable: false });
  });
});
