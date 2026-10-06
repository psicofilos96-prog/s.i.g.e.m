import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runSemanticQuery, toTable, toPivot, toKpi, toChartSeries, toReportResult, comparabilityOf, methodologyNotes, type Dataset } from "./semantic-layer";
import { toCsv } from "@/features/reports/report-engine";

// Dois programas sintéticos com unidades diferentes: proficiência (escala A) e acerto % (escala B).
const ds = (scaleKey: string, unit: string): Dataset => ({ id: "d", version: 1, label: "d", source: "reader-sintetico", grain: "aluno×item",
  dimensions: [{ id: "school_id", label: "Escola" }, { id: "item_id", label: "Item" }, { id: "student_id", label: "Estudante", sensitive: true }],
  measures: [{ id: "v", label: "Valor", unit, scaleKind: "numerico", nature: "observado", aggregations: ["media", "contagem"], scaleKey }], joins: [], readCapability: "x" });
const A = ds("prof-A", "pontos (escala A)");
const rowsA = [
  { school_id: "e1", item_id: "i1", student_id: "s1", v: 200, scale_key: "prof-A" },
  { school_id: "e1", item_id: "i2", student_id: "s1", v: null, scale_key: "prof-A" },
  { school_id: "e2", item_id: "i1", student_id: "s2", v: 0, scale_key: "prof-A" },
  { school_id: "e3", item_id: "i1", student_id: "s3", v: null, scale_key: "prof-A" },
];
const q = { datasetId: "d", measureId: "v", aggregation: "media" as const, groupBy: ["school_id"], knownAt: "2026-10-06T00:00:00Z", asOf: "2026-06-30" };

describe("BM.1 camada semântica", () => {
  it("não mistura escalas de programas diferentes", () => {
    expect(() => runSemanticQuery(A, q, [...rowsA, { school_id: "e1", item_id: "i1", student_id: "s9", v: 0.7, scale_key: "pct-B" }])).toThrow(/escalas/);
    expect(() => runSemanticQuery(A, q, [{ school_id: "e1", v: 1, scale_key: "pct-B" }])).toThrow(/outra escala/);
  });
  it("zero ≠ unknown", () => {
    const r = runSemanticQuery(A, q, rowsA);
    const st = Object.fromEntries(r.cells.map((c) => [c.key[0], c.state]));
    expect(st).toEqual({ e1: "AVAILABLE", e2: "ZERO", e3: "UNKNOWN" });
    expect(r.cells.find((c) => c.key[0] === "e3")!.value).toBeNull();
  });
  it("dado pessoal não entra por padrão", () => {
    expect(() => runSemanticQuery(A, { ...q, groupBy: ["student_id"] }, rowsA)).toThrow(/pessoal/);
    expect(runSemanticQuery(A, { ...q, groupBy: ["student_id"], includeSensitive: true }, rowsA).cells.length).toBe(3);
  });
  it("tabela, pivot, KPI, gráfico e CSV saem do mesmo resultado", () => {
    const r = runSemanticQuery(A, q, rowsA);
    const t = toTable(r); const series = toChartSeries(r);
    expect(series.map((s) => s.value)).toEqual(t.rows.map((x) => x[1]));
    const { def, result } = toReportResult(r);
    const csv = toCsv(result, { headerLines: [], title: def.title }, methodologyNotes(r));
    expect(csv).toContain("não disponível"); expect(csv).toContain("Cruzamento entre dados não indica causa");
    expect(toPivot(runSemanticQuery(A, { ...q, groupBy: ["school_id", "item_id"] }, rowsA)).rowKeys).toEqual(["e1", "e2", "e3"]);
    const k = toKpi(runSemanticQuery(A, { ...q, groupBy: [] }, rowsA));
    expect(k.value).toBe(100); expect(k.nature).toBe("derivado"); expect(k.unit).toBe("pontos (escala A)");
  });
  it("comparabilidade só por declaração; ausente = unknown", () => {
    expect(comparabilityOf("m1", "m2", [])).toBe("unknown");
    expect(comparabilityOf("m2", "m1", [{ metric_a: "m1", metric_b: "m2", status: "not_comparable" }])).toBe("not_comparable");
  });
  it("escala categórica só admite contagem; agregação não prevista recusada", () => {
    const C: Dataset = { ...A, measures: [{ ...A.measures[0]!, scaleKind: "categorico", aggregations: ["media", "contagem"] }] };
    expect(() => runSemanticQuery(C, q, rowsA)).toThrow(/categórica/);
    expect(() => runSemanticQuery(A, { ...q, aggregation: "soma" }, rowsA)).toThrow(/não admite/);
  });
  it("migration 0179: sem DML a app roles, writers exigem pessoa natural, painel guarda só referência", () => {
    const sql = readFileSync("drizzle/migrations/0179_bm_educational_intelligence_foundation.sql", "utf8");
    expect(sql).toMatch(/REVOKE ALL ON public\.%I FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)/);
    expect(sql).toMatch(/x \? 'rows' OR x \? 'data'/);
    expect((sql.match(/af_natural_person\(\)/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(sql).not.toMatch(/INSERT INTO public\.\w+ *\(.*\)\s*VALUES\s*\('/); // sem seed
  });
});
