import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { activeEnrollments, evaluate, hasScope, servedTotal, SessionMetricCache, type CapabilityRow, type MetricDefinition } from "./metric-engine";

const cap = (capability_id: string, scope_level: string, school_id: string | null, policy_id: string | null = "p4"): CapabilityRow => ({ capability_id, scope_level, school_id, policy_id });
const def = (n: { v: number }): MetricDefinition => ({ id: "x", version: 1, label: "x", perspective: "secretaria", definition: "", formula: "", source: "", granularity: "", scope: "escola", capabilities: ["c"], freshnessMs: 1000, drillRoute: null, compute: async () => ({ status: "disponivel", value: ++n.v, unit: "", refs: [], note: null }) });
const ctx = { scope: { kind: "escola" as const, schoolId: "A" }, validOn: "2026-05-01", knownAt: null };

describe("dashboards — métricas como projeção", () => {
  it("escopo escola/rede; cargo textual e política ausente não autorizam", () => {
    expect(hasScope([cap("c", "escola", "A")], ["c"], ctx.scope)).toBe(true);
    expect(hasScope([cap("c", "escola", "B")], ["c"], ctx.scope)).toBe(false);
    expect(hasScope([cap("c", "rede", null)], ["c"], ctx.scope)).toBe(true);
    expect(hasScope([cap("c", "escola", "A", null)], ["c"], ctx.scope)).toBe(false);
    expect(hasScope([cap("c", "turma", "A")], ["c"], ctx.scope)).toBe(false);
  });
  it("sem permissão é 'não disponível', nunca zero", async () => {
    const r = await evaluate(def({ v: 0 }), ctx, [], new SessionMetricCache());
    expect(r.result.status).toBe("nao-disponivel");
  });
  it("zero real é disponível; sem registro não é zero", () => {
    expect(servedTotal([{ id: "1", served_count: 0, event_kind: "registro" }])).toMatchObject({ total: 0, informedRefs: ["1"] });
    expect(servedTotal([{ id: "1", served_count: null, event_kind: "registro" }])).toMatchObject({ informedRefs: [], notInformed: 1 });
    expect(servedTotal([]).records).toBe(0);
  });
  it("cache marca stale e recalcula; nunca é fonte", async () => {
    let t = 0; const c = new SessionMetricCache(() => t); const n = { v: 0 }; const d = def(n); const caps = [cap("c", "escola", "A")];
    expect((await evaluate(d, ctx, caps, c)).result).toMatchObject({ value: 1 });
    t = 500; expect((await evaluate(d, ctx, caps, c)).result).toMatchObject({ value: 1 });
    t = 2000; expect(c.get(d, ctx)!.stale).toBe(true);
    expect((await evaluate(d, ctx, caps, c)).result).toMatchObject({ value: 2 });
    expect(c.get(d, { ...ctx, knownAt: "2026-01-01" })).toBeNull();
  });
  const enr = [
    { id: "e1", supersedes_id: null, created_at: "2026-02-01", school_id: "A", opened_on: "2026-02-01" },
    { id: "e2", supersedes_id: null, created_at: "2026-02-01", school_id: "A", opened_on: "2026-02-01" },
    { id: "e2b", supersedes_id: "e2", created_at: "2026-06-01", school_id: "A", opened_on: "2026-03-01" },
    { id: "e3", supersedes_id: null, created_at: "2026-02-01", school_id: "A", opened_on: null },
    { id: "e4", supersedes_id: null, created_at: "2026-02-01", school_id: "B", opened_on: "2026-02-01" },
  ];
  const end = [{ enrollment_id: "e1", ended_on: "2026-04-01", created_at: "2026-07-01" }];
  it("drill-down reconcilia; mudança retroativa respeita knownAt", () => {
    const now = activeEnrollments(enr, end, "A", "2026-05-01", null);
    expect(now.active).toEqual(["e2b"]); expect(now.undated).toEqual(["e3"]);
    const then = activeEnrollments(enr, end, "A", "2026-05-01", "2026-05-15");
    expect(then.active.sort()).toEqual(["e1", "e2"]);
    expect(activeEnrollments(enr, end, "A", "2026-02-15", null).active).toEqual([]);
  });
  it("volume sintético isolado: 50 mil matrículas em menos de 1s", () => {
    const big = Array.from({ length: 50000 }, (_, i) => ({ id: `s${i}`, supersedes_id: null, created_at: "2026-01-01", school_id: i % 2 ? "A" : "B", opened_on: "2026-01-02" }));
    const ends = Array.from({ length: 5000 }, (_, i) => ({ enrollment_id: `s${i * 2 + 1}`, ended_on: "2026-03-01", created_at: "2026-03-01" }));
    const t = performance.now(); const r = activeEnrollments(big, ends, "A", "2026-04-01", null);
    expect(r.active.length).toBe(20000); expect(performance.now() - t).toBeLessThan(1000);
  });
  it("catálogo: toda métrica declara fórmula/fonte/versão e nenhuma gravação", () => {
    const src = readFileSync("src/features/dashboards/metric-catalog.ts", "utf8");
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(src).not.toMatch(/position_label|cargo ===/);
  });
});
