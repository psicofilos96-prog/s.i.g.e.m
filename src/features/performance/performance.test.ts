import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { aggregate, applyDisclosure, compareTemporal, computeMetric, goalStatus, reconciles, type AssessmentVersion, type MetricVersion, type ResultRow } from "./performance-model";
import { adapterById } from "@/features/data-import/adapters";
import { classifyRows } from "@/features/data-import/import-engine";

const r = (id: string, o: Partial<ResultRow> = {}): ResultRow => ({
  id, logical_id: id, version: 1, event_kind: "registro", assessment_logical_id: "A", assessment_version_id: "A1",
  school_id: "e1", student_id: id, class_id: "t1", item_id: null, status: "observado", raw_value: "5", numeric_value: 5, recorded_at: "2026-01-01", ...o,
});
const num = { kind: "numerico" as const };
const asmt = (pop: string): AssessmentVersion => ({ id: "A1", logical_id: "A", version: 1, event_kind: "registro", title: "x", origin: "institucional", source_note: null, applied_from: "2026-01-01", applied_to: "2026-01-02", target_population: [{ axis_id: "posicao-curricular-individual", value_id: pop }], items: [], scale: num, recorded_at: "" });
const metric = (o: Partial<MetricVersion> = {}): MetricVersion => ({ id: "M1", logical_id: "M", version: 1, event_kind: "registro", label: "m", assessment_logical_id: "A", formula: { op: "media" }, population_key: "p", unit_label: null, source_note: "s", recorded_at: "", ...o });

describe("Avaliação e Desempenho", () => {
  it("ausência não vira zero: grupo sem observados fica sem base", () => {
    const v = computeMetric({ op: "media" }, num, [r("a", { status: "ausente", raw_value: null, numeric_value: null })]);
    expect(v.status).toBe("sem-base");
    expect(computeMetric({ op: "media" }, num, []).status).toBe("sem-base");
  });
  it("resultado retificado/revogado sai da base sem apagar histórico", () => {
    const v = computeMetric({ op: "media" }, num, [r("a", { numeric_value: 4 }), r("b", { event_kind: "revogacao", numeric_value: 10 })]);
    expect(v.status === "calculada" && v.value).toBe(4);
  });
  it("fórmula de média recusa escala categórica", () => {
    expect(computeMetric({ op: "media" }, { kind: "categorico", values: ["A"] }, [r("a")]).status).toBe("formula-incompativel");
  });
  it("agregação reconcilia até os registros", () => {
    const rows = [r("a", { school_id: "e1" }), r("b", { school_id: "e2" }), r("c", { school_id: "e2" })];
    const total = computeMetric({ op: "media" }, num, rows);
    const parts = aggregate(rows, "escola", { op: "media" }, num, null).map((g) => g.metric);
    expect(reconciles(total, parts)).toBe(true);
  });
  it("posição só por mapa explícito; sem mapa ⇒ não informado", () => {
    const g = aggregate([r("a")], "posicao", { op: "media" }, num, null);
    expect(g[0]!.label).toBe("Não informado");
  });
  it("supressão só com política e complementar", () => {
    const groups = [{ key: "x", students: 2 }, { key: "y", students: 10 }, { key: "z", students: 12 }];
    expect(applyDisclosure(groups, null).every((g) => g.disclosed)).toBe(true);
    const s = applyDisclosure(groups, { id: "d", min_group_size: 5, source_note: "s" });
    expect(s.filter((g) => !g.disclosed).map((g) => g.key)).toEqual(["x", "y"]);
  });
  it("comparação temporal recusa população ou fórmula diferentes", () => {
    const v = computeMetric({ op: "media" }, num, [r("a")]);
    expect(compareTemporal({ metric: metric(), assessment: asmt("p1"), value: v }, { metric: metric(), assessment: asmt("p2"), value: v }).comparable).toBe(false);
    expect(compareTemporal({ metric: metric(), assessment: asmt("p1"), value: v }, { metric: metric({ formula: { op: "contagem-observados" } }), assessment: asmt("p1"), value: v }).comparable).toBe(false);
    expect(compareTemporal({ metric: metric(), assessment: asmt("p1"), value: v }, { metric: metric(), assessment: asmt("p1"), value: v })).toEqual({ comparable: true, delta: 0 });
  });
  it("meta sem base não é atingida nem perdida", () => {
    expect(goalStatus({ id: "g", metric_version_id: "M1", school_id: null, target_value: 5, comparator: ">=", source_note: "s" }, computeMetric({ op: "media" }, num, []))).toBe("sem-base");
  });
  it("importação: chave de identidade, duplicidade e linha inválida", () => {
    const ad = adapterById("resultado-avaliacao-institucional")!;
    const rows = ad.parse("estudante;item;situacao;valor\ns1;;observado;7\ns1;;observado;8\n;;observado;1\ns2;;talvez;\n");
    const c = classifyRows(ad, rows, []);
    expect(c.map((x) => x.outcome)).toEqual(["valida", "duplicada-na-fonte", "rejeitada", "rejeitada"]);
  });
  it("banco: writers com capability, idempotência por plan_key, append-only e sem limiar semeado", () => {
    const sql = readFileSync("drizzle/migrations/0075_institutional_assessment_performance.sql", "utf8");
    expect(sql).toMatch(/plan_key text UNIQUE/);
    expect(sql).toMatch(/import_append_only/);
    expect(sql).toMatch(/REVOKE ALL ON public\.%I FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/INSERT INTO public\.performance_disclosure_versions[^;]*VALUES \(\s*gen_random_uuid/);
    expect(sql).not.toMatch(/IDEB|proficiencia|SAEB/i);
  });
});

import { heatmap, heatBand } from "./performance-model";
describe("N6.2 heatmap", () => {
  const r = (id: string, school: string, item: string, v: number | null, status: "observado" | "ausente" = "observado") => ({ id, logical_id: id, version: 1, event_kind: "registro", assessment_logical_id: "a", assessment_version_id: "a1", school_id: school, student_id: id, class_id: null, item_id: item, status, raw_value: v === null ? null : String(v), numeric_value: v, recorded_at: "t" });
  it("ausência de resultado é sem-dado, zero observado é calculado", () => {
    const h = heatmap([r("1", "A", "h1", 0), r("2", "B", "h2", 5)], { op: "media" }, { kind: "numerico", min: 0, max: 10 }, null);
    expect(h.items).toEqual(["h1", "h2"]); expect(h.schools).toEqual(["A", "B"]);
    const a1 = h.cells.find((c) => c.item === "h1" && c.school === "A")!; const b1 = h.cells.find((c) => c.item === "h1" && c.school === "B")!;
    expect(a1.metric).toMatchObject({ status: "calculada", value: 0 }); expect(b1.metric).toBeNull();
    expect(heatBand(a1.metric, 0, 10)).toBe(0); expect(heatBand(b1.metric, 0, 10)).toBeNull();
  });
  it("só ausentes ⇒ sem-base, sem cor", () => {
    const h = heatmap([r("1", "A", "h1", null, "ausente")], { op: "media" }, { kind: "numerico", min: 0, max: 10 }, null);
    expect(h.cells[0]!.metric?.status).toBe("sem-base"); expect(heatBand(h.cells[0]!.metric, 0, 10)).toBeNull();
  });
});
