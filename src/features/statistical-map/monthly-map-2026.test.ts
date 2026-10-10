import { describe, expect, it } from "vitest";
import { canFreeze, modelSchoolMonth, type ModelEpisode, compareMonths, effectiveRow, latestClosures, networkMonth, normalizeMonthly, referenceDate, type Closure } from "./monthly-map-2026";
import { readFileSync } from "node:fs";

const raw = (o: Record<string, unknown>) => ({ school_id: "A", inep: "1", school_name: "Escola A", reference_date: "2026-07-31", earliest_evidence: "2026-07-31",
  status: "apurado", distinct_students: 100, school_enrollments: 0, undated_enrollments: 100, bonds: 110, regular_bonds: 100, aee_bonds: 10,
  aee_students: 10, aee_only_students: 1, classes_with_students: 8, entries_in_month: 110, exits_in_month: 0, ...o });

describe("mapa mensal 2026", () => {
  it("mês sem histórico não mostra números (nem zero nem cópia do Censo)", () => {
    const r = normalizeMonthly([raw({ status: "nao-apurado", reference_date: "2026-03-31" })])[0]!;
    expect(r.distinct_students).toBeNull();
    expect(r.bonds).toBeNull();
  });
  it("matrícula sem data de início não é afirmada como vigente no mês", () => {
    expect(normalizeMonthly([raw({})])[0]!.school_enrollments).toBeNull();
  });
  it("AEE não conta como novo aluno: só-AEE é subconjunto dos alunos distintos", () => {
    const r = normalizeMonthly([raw({})])[0]!;
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
    const e = effectiveRow(normalizeMonthly([raw({ bonds: 115 })])[0]!, latest);
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

  it("banco v2: fotografia de carga vira estimativa parcial e writer só congela mês encerrado, apurado e justificado", () => {
    const sql = readFileSync("drizzle/migrations/0284_monthly_map_2026_evidence_v2.sql", "utf8");
    expect(sql).toMatch(/monthly_map_2026_live_v2[\s\S]*SECURITY INVOKER/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public.monthly_map_2026_live_v2\(integer\) FROM public, anon/);
    expect(sql).toMatch(/technical-operation:%/);
    expect(sql).toMatch(/'estimativa-parcial'/);
    expect(sql).toMatch(/reference_date >= current_date THEN RAISE EXCEPTION/);
    expect(sql).toMatch(/status <> 'apurado' THEN RAISE EXCEPTION/);
    expect(sql).toMatch(/exigem justificativa/);
  });
});

const T = "2026-10-10";
const ep = (o: Partial<ModelEpisode>): ModelEpisode => ({ student: "s1", class: "c1", aee: false, validFrom: "2026-02-03", endedOn: null, snapshot: false, ...o });

describe("mapa mensal 2026 — regras por caso", () => {
  it("fotografia concentrada em 31/07 nunca vira 'apurado': julho–setembro são estimativa parcial", () => {
    const eps = [ep({ validFrom: "2026-07-31", snapshot: true }), ep({ student: "s2", validFrom: "2026-07-31", snapshot: true })];
    for (const m of [7, 8, 9]) { const r = modelSchoolMonth(eps, m, T); expect(r.status).toBe("estimativa-parcial"); expect(r.coverage_pct).toBe(0); }
    expect(modelSchoolMonth(eps, 6, T).status).toBe("nao-apurado");
    expect(modelSchoolMonth(eps, 7, T).entries_in_month).toBe(0); // carga não é entrada no mês
  });
  it("outubro em 10/10 é provisório e não pode ser congelado", () => {
    const r = modelSchoolMonth([ep({})], 10, T);
    expect(r.status).toBe("mes-nao-encerrado");
    expect(canFreeze({ status: r.status, reference_date: referenceDate(10) }, T)).toBe(false);
    expect(canFreeze({ status: "estimativa-parcial", reference_date: referenceDate(8) }, T)).toBe(false);
    expect(canFreeze({ status: "apurado", reference_date: referenceDate(8) }, T)).toBe(true);
  });
  it("evidência datada parcial mantém estimativa e mostra cobertura", () => {
    const r = modelSchoolMonth([ep({}), ep({ student: "s2", validFrom: "2026-07-31", snapshot: true })], 8, T);
    expect(r.status).toBe("estimativa-parcial"); expect(r.coverage_pct).toBe(50);
  });
  it("AEE: aluno regular+AEE é 1 aluno e 2 vínculos; só-AEE conta à parte", () => {
    const r = modelSchoolMonth([ep({}), ep({ class: "aee", aee: true }), ep({ student: "s3", class: "aee", aee: true })], 3, T);
    expect(r.distinct_students).toBe(2); expect(r.bonds).toBe(3); expect(r.aee_bonds).toBe(2); expect(r.aee_only_students).toBe(1);
  });
  it("EJA: turma de EJA conta como enturmação regular, sem duplicar aluno", () => {
    const r = modelSchoolMonth([ep({ class: "eja-1" }), ep({ student: "s2", class: "eja-1" })], 4, T);
    expect(r.regular_bonds).toBe(2); expect(r.distinct_students).toBe(2); expect(r.status).toBe("apurado");
  });
  it("dupla matrícula: mesmo aluno em duas turmas regulares = 1 aluno distinto, 2 vínculos", () => {
    const r = modelSchoolMonth([ep({ class: "c1" }), ep({ class: "c2" })], 5, T);
    expect(r.distinct_students).toBe(1); expect(r.bonds).toBe(2);
  });
  it("transferência no mês: saída em 15/05 conta como saída de maio e some do fim de maio", () => {
    const eps = [ep({ endedOn: "2026-05-15" })];
    expect(modelSchoolMonth(eps, 4, T).bonds).toBe(1);
    const mai = modelSchoolMonth(eps, 5, T);
    expect(mai.exits_in_month).toBe(1); expect(mai.bonds).toBe(0); expect(mai.status).toBe("nao-apurado");
  });
  it("retorno: saída em maio e novo episódio em junho ⇒ entrada em junho e aluno de volta", () => {
    const eps = [ep({ endedOn: "2026-05-15" }), ep({ validFrom: "2026-06-02" })];
    const jun = modelSchoolMonth(eps, 6, T);
    expect(jun.entries_in_month).toBe(1); expect(jun.distinct_students).toBe(1); expect(jun.exits_in_month).toBe(0);
  });
  it("datas desconhecidas: matrícula sem data de início não é afirmada vigente", () => {
    expect(normalizeMonthly([raw({ status: "estimativa-parcial" })])[0]!.school_enrollments).toBeNull();
  });
  it("comparativo mês a mês: estimativa × apurado calcula diferença; não apurado fica indisponível", () => {
    const a = networkMonth(normalizeMonthly([raw({ status: "estimativa-parcial", bonds: 100 })])).totals;
    const b = networkMonth(normalizeMonthly([raw({ bonds: 104 })])).totals;
    expect(compareMonths(a, b).find((x) => x.key === "bonds")!.delta).toBe(4);
    const n = networkMonth(normalizeMonthly([raw({ status: "estimativa-parcial" })]));
    expect(n.complete).toBe(false); expect(n.estimadas).toBe(1); expect(n.apuradas).toBe(0);
  });
});
