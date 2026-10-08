import { describe, expect, it } from "vitest";
import type { AssessmentVersion, MetricVersion, ResultRow } from "./performance-model";
import {
  EXPORT_BLOCKED_NO_POLICY, STATION_REPORTS, evolutionRows, evolutionSeries, exportEvolution, exportHeatmap, heatmapRows, stationHome,
} from "./performance-station";
import { runReport } from "@/features/reports/report-engine";

const asm = (id: string, from: string, origin: "institucional" | "externa" = "institucional"): AssessmentVersion => ({
  id, logical_id: id, version: 1, event_kind: "constituicao", title: `Edição ${id}`, origin, source_note: null, applied_from: from, applied_to: from,
  target_population: [{ axis_id: "ano", value_id: "5" }], items: [{ item_id: "h1", label: "Habilidade 1" }, { item_id: "h2", label: "=cmd|x" }], scale: { kind: "numerico", min: 0, max: 10 }, recorded_at: "",
} as unknown as AssessmentVersion);
const metric = (id = "m", f: MetricVersion["formula"] = { op: "media" }): MetricVersion => ({ id, logical_id: "m", version: 1, event_kind: "constituicao", label: "Média", assessment_logical_id: "a", formula: f, population_key: "p", unit_label: null, source_note: "fonte", recorded_at: "" } as MetricVersion);
let n = 0;
const res = (school: string, item: string | null, v: number | null, status = "observado"): ResultRow => ({ id: `r${n++}`, school_id: school, class_id: null, student_id: `s${n}`, item_id: item, status, raw_value: v === null ? null : String(v), numeric_value: v, version: 1, event_kind: "constituicao" } as unknown as ResultRow);
const policy = { id: "d", min_group_size: 1, source_note: "Política X" };

describe("N6.2.4 — heatmap exportável", () => {
  const rows = [res("E1", "h1", 6), res("E1", "h1", 8), res("E2", "h2", 4)];
  it("mesmas células da tela; sem dado ≠ zero; ordem do motor, não por valor", () => {
    const hr = heatmapRows(rows, metric(), asm("a", "2026-03-01"), policy);
    const e1h2 = hr.find((r) => r["escola"] === "E1" && r["habilidade"] === "=cmd|x")!;
    expect(e1h2).toMatchObject({ valor: null, situacao: "sem dado" });
    expect(hr.find((r) => r["escola"] === "E1" && r["habilidade"] === "Habilidade 1")).toMatchObject({ valor: 7, base: 2 });
  });
  it("CSV neutraliza fórmula e PDF é A4 com escape; meta diz que não é ranking", () => {
    const out = exportHeatmap(rows, metric(), asm("a", "2026-03-01"), policy, new Date("2026-10-08T12:00:00Z"));
    if (!out.ok) throw new Error(out.reason);
    expect(out.csv).toContain("'=cmd|x"); expect(out.csv).toContain("não disponível");
    expect(out.html).toMatch(/@page\{size:A4/); expect(out.html).toContain("não é ranking");
  });
  it("sem política de divulgação, exportação recusa com motivo", () => {
    expect(exportHeatmap(rows, metric(), asm("a", "2026-03-01"), null)).toEqual({ ok: false, reason: EXPORT_BLOCKED_NO_POLICY });
  });
});

describe("N6.2.4 — evolução com 3+ edições", () => {
  const ed = (id: string, from: string, vals: number[], m = metric(`m-${id}`)) => ({ assessment: asm(id, from), metrics: [m], results: vals.map((v) => res("E1", null, v)) });
  it("ordena por data (cronologia), compara cada passo com o anterior", () => {
    const ev = evolutionSeries(metric(), [ed("c", "2026-09-01", [8]), ed("a", "2026-03-01", [5]), ed("b", "2026-06-01", [6])]);
    expect(ev.enough).toBe(true);
    expect(ev.points.map((p) => p.assessment.logical_id)).toEqual(["a", "b", "c"]);
    expect(ev.steps).toMatchObject([{ comparable: true, delta: 1, deltaPercent: 20 }, { comparable: true, delta: 2 }]);
    const r = evolutionRows(ev);
    expect(r[1]).toMatchObject({ variacao: 1, variacao_pct: 20 });
  });
  it("menos de 3 edições não monta evolução", () => {
    expect(evolutionSeries(metric(), [ed("a", "2026-03-01", [5]), ed("b", "2026-06-01", [6])]).enough).toBe(false);
  });
  it("fórmula diferente rompe o passo explicitamente; edição sem métrica não vira zero", () => {
    const ev = evolutionSeries(metric(), [ed("a", "2026-03-01", [5]), ed("b", "2026-06-01", [6], metric("x", { op: "contagem-observados" })), { assessment: asm("c", "2026-09-01"), metrics: [], results: [] }]);
    expect(ev.steps[0]).toMatchObject({ comparable: false });
    expect(evolutionRows(ev)[2]).toMatchObject({ valor: null, observacao: "Sem métrica correspondente." });
  });
  it("exportação da evolução também exige política", () => {
    const ev = evolutionSeries(metric(), [ed("a", "2026-03-01", [5]), ed("b", "2026-06-01", [6]), ed("c", "2026-09-01", [7])]);
    expect(exportEvolution(ev, metric(), null).ok).toBe(false);
    expect(exportEvolution(ev, metric(), policy).ok).toBe(true);
  });
});

describe("N6.2.4 — home e relatórios da estação", () => {
  it("home só conta fatos; revogada não conta; aponta política ausente", () => {
    const h = stationHome([asm("a", "2026-03-01"), asm("b", "2026-06-01", "externa"), { ...asm("c", "2026-09-01"), event_kind: "revogacao" } as AssessmentVersion], null);
    expect(h).toMatchObject({ total: 2, byOrigin: { institucional: 1, externa: 1 }, latestApplication: "2026-06-01", policy: "ausente" });
    expect(h.nextSteps[0]).toMatch(/política de divulgação/);
  });
  it("BNCC×SAEB fica catalogado com dependência e recusa execução", () => {
    const d = STATION_REPORTS.find((r) => r.id === "avaliacao-bncc-saeb")!;
    expect(() => runReport(d, { params: {} }, [])).toThrow(/DEPENDE_DADO/);
  });
});
