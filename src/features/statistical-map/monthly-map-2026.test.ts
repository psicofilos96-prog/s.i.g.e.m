import { describe, expect, it } from "vitest";
import { compareMonths, effectiveRow, latestClosures, networkMonth, normalizeMonthly, referenceDate, type Closure } from "./monthly-map-2026";
import { readFileSync } from "node:fs";

const raw = (o: Record<string, unknown>) => ({ school_id: "A", inep: "1", school_name: "Escola A", reference_date: "2026-07-31", earliest_evidence: "2026-07-31",
  status: "apurado", distinct_students: 100, school_enrollments: 0, undated_enrollments: 100, bonds: 110, regular_bonds: 100, aee_bonds: 10,
  aee_students: 10, aee_only_students: 1, classes_with_students: 8, entries_in_month: 110, exits_in_month: 0, ...o });

describe("mapa mensal 2026", () => {
  it("mês sem histórico não mostra números (nem zero nem cópia do Censo)", () => {
    const [r] = normalizeMonthly([raw({ status: "nao-apurado", reference_date: "2026-03-31" })]);
    expect(r.distinct_students).toBeNull();
    expect(r.bonds).toBeNull();
  });
  it("matrícula sem data de início não é afirmada como vigente no mês", () => {
    expect(normalizeMonthly([raw({})])[0].school_enrollments).toBeNull();
  });
  it("AEE não conta como novo aluno: só-AEE é subconjunto dos alunos distintos", () => {
    const [r] = normalizeMonthly([raw({})]);
    expect(r.bonds).toBe((r.regular_bonds as number) + (r.aee_bonds as number));
    expect(r.aee_only_students! <= r.distinct_students!).toBe(true);
  });
  it("rede soma só escolas apuradas e sinaliza consolidação parcial", () => {
    const n = networkMonth(normalizeMonthly([raw({}), raw({ school_id: "B", status: "nao-apurado" })]));
    expect(n.apuradas).toBe(1); expect(n.complete).toBe(false); expect(n.totals.bonds).toBe(110);
  });
  it("mês todo não apurado ⇒ total da rede indisponível, nunca zero", () => {
    expect(networkMonth(normalizeMonthly([raw({ status: "nao-apurado" })])).totals.bonds).toBeNull();
  });
  it("comparativo com mês não apurado não inventa diferença", () => {
    const a = networkMonth(normalizeMonthly([raw({ status: "nao-apurado" })])).totals;
    const b = networkMonth(normalizeMonthly([raw({})])).totals;
    expect(compareMonths(a, b).find((x) => x.key === "bonds")!.delta).toBeNull();
  });
  it("transferência/saída: diferença entre meses reflete a saída", () => {
    const jul = networkMonth(normalizeMonthly([raw({})])).totals;
    const ago = networkMonth(normalizeMonthly([raw({ bonds: 109, regular_bonds: 99, exits_in_month: 1 })])).totals;
    expect(compareMonths(jul, ago).find((x) => x.key === "bonds")!.delta).toBe(-1);
  });
  it("apuração congelada prevalece e alterações posteriores aparecem só como deriva", () => {
    const c: Closure = { school_id: "A", map_month: 7, version: 1, kind: "apuracao", reference_date: "2026-07-31", measures: { bonds: 110, distinct_students: 100 }, digest: "x", reason: null, created_at: "" };
    const c2 = { ...c, version: 2, kind: "revisao" as const, measures: { bonds: 111 } };
    const latest = latestClosures([c, c2]).get("A:7")!;
    expect(latest.version).toBe(2);
    const e = effectiveRow(normalizeMonthly([raw({ bonds: 115 })])[0], latest);
    expect(e.bonds).toBe(111);
    expect(e.driftFromFrozen).toContain("bonds");
  });
  it("data de referência é o último dia do mês", () => {
    expect(referenceDate(2)).toBe("2026-02-28");
    expect(referenceDate(7)).toBe("2026-07-31");
  });
  it("banco: leitura INVOKER sem anon e apuração append-only exigindo competência e motivo na revisão", () => {
    const sql = readFileSync("drizzle/migrations/0283_monthly_map_2026.sql", "utf8");
    expect(sql).toMatch(/monthly_map_2026_live[\s\S]*SECURITY INVOKER/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public.monthly_map_2026_live\(integer\) FROM public, anon/);
    expect(sql).toMatch(/aa_ledger_append_only/);
    expect(sql).toMatch(/has_school_capability\('oficializar-mapa-estatistico', _school\)/);
    expect(sql).toMatch(/revisão exige motivo/);
    expect(sql).not.toMatch(/GRANT (SELECT|INSERT)[^;]*monthly_map_2026_closures TO anon/);
    expect(sql).not.toMatch(/GRANT[^;]*INSERT[^;]*monthly_map_2026_closures TO authenticated/);
  });
});
