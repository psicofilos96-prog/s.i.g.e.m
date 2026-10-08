import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import type { AssessmentVersion, MetricVersion, ResultRow } from "./performance-model";
import { STATION_REPORTS, evolutionSeries, exportEvolution, exportHeatmap } from "./performance-station";

// N6.2.5 — auditoria final: exports de TESTE (dados sintéticos, nunca oficiais).
const asm = (id: string, from: string): AssessmentVersion => ({
  id, logical_id: id, version: 1, event_kind: "constituicao", title: `Edição de teste ${id}`, origin: "institucional", source_note: null,
  applied_from: from, applied_to: from, target_population: [{ axis_id: "ano", value_id: "5" }],
  items: [{ item_id: "h1", label: "Habilidade 1" }, { item_id: "h2", label: "Habilidade 2" }], scale: { kind: "numerico", min: 0, max: 10 }, recorded_at: "",
} as unknown as AssessmentVersion);
const metric = (id = "m"): MetricVersion => ({ id, logical_id: "m", version: 1, event_kind: "constituicao", label: "Média", assessment_logical_id: "a", formula: { op: "media" }, population_key: "p", unit_label: null, source_note: "teste", recorded_at: "" } as MetricVersion);
let n = 0;
const res = (school: string, item: string | null, v: number | null): ResultRow => ({ id: `r${n++}`, school_id: school, class_id: null, student_id: `s${n}`, item_id: item, status: "observado", raw_value: v === null ? null : String(v), numeric_value: v, version: 1, event_kind: "constituicao" } as unknown as ResultRow);
const policy = { id: "d", min_group_size: 1, source_note: "Política de TESTE" };
const OUT = process.env["N625_EXPORT_DIR"];

describe("N6.2.5 — exports de teste da estação Avaliação", () => {
  it("heatmap: CSV e PDF saem pelo motor, ausência ≠ zero", () => {
    const out = exportHeatmap([res("Escola A", "h1", 6), res("Escola A", "h1", 8), res("Escola B", "h2", 4)], metric(), asm("a", "2026-03-01"), policy, new Date("2026-10-08T12:00:00Z"));
    if (!out.ok) throw new Error(out.reason);
    expect(out.csv).toContain("não disponível");
    if (OUT) { mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/heatmap-teste.csv`, out.csv); writeFileSync(`${OUT}/heatmap-teste.html`, out.html); }
  });
  it("evolução: 3 edições em ordem cronológica", () => {
    const ed = (id: string, from: string, v: number) => ({ assessment: asm(id, from), metrics: [metric(`m-${id}`)], results: [res("Escola A", null, v)] });
    const ev = evolutionSeries(metric(), [ed("c", "2026-09-01", 8), ed("a", "2026-03-01", 5), ed("b", "2026-06-01", 6)]);
    const out = exportEvolution(ev, metric(), policy, new Date("2026-10-08T12:00:00Z"));
    if (!out.ok) throw new Error(out.reason);
    expect(out.csv.indexOf("Edição de teste a")).toBeLessThan(out.csv.indexOf("Edição de teste c"));
    if (OUT) { writeFileSync(`${OUT}/evolucao-teste.csv`, out.csv); writeFileSync(`${OUT}/evolucao-teste.html`, out.html); }
  });
  it("BNCC↔SAEB continua sem formato de exportação", () => {
    expect(STATION_REPORTS.find((r) => r.id === "avaliacao-bncc-saeb")!.formats).toEqual([]);
  });
});
