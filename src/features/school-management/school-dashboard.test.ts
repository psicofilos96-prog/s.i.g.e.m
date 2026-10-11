import { describe, expect, it } from "vitest";
import { METRICS, dashboardFilter, diagnose, metricView, schoolFicha } from "./school-dashboard";

const def = (k: string) => METRICS.find((m) => m.key === k)!;
const ctx = { calendarResolved: true, thresholdHomologated: true };

describe("Painel da Direção — Lote 02", () => {
  it("zero só quando observado; não registrado ≠ zero", () => {
    expect(metricView(def("turmas"), { ok: true, data: { value: 0, asOf: "2026-10-11" } }, ctx).state).toBe("ZERO");
    const nr = metricView(def("turmas"), { ok: true, data: { recorded: false, reason: "sem composição" } }, ctx);
    expect(nr).toMatchObject({ state: "UNKNOWN", value: null });
    expect(metricView(def("turmas"), { ok: false, error: "permission denied" }, ctx).state).toBe("UNAVAILABLE");
  });
  it("frequência e dias letivos bloqueiam sem calendário; infrequência sem limiar", () => {
    expect(metricView(def("frequencia"), { ok: true, data: { value: 90, asOf: "x" } }, { ...ctx, calendarResolved: false }).state).toBe("BLOCKED");
    expect(metricView(def("infrequentes"), undefined, { ...ctx, thresholdHomologated: false }).note).toMatch(/limiar/);
  });
  it("toda métrica declara fórmula, fonte e drill-down", () => {
    for (const m of METRICS) expect(m.formula && m.source && m.drill.startsWith("/")).toBeTruthy();
  });
  it("filtro exige ano e período do ano", () => {
    expect(dashboardFilter({ year: null, periodId: null }, [])).toMatchObject({ ok: false });
    expect(dashboardFilter({ year: 2026, periodId: "p27" }, [{ id: "p27", year: 2027 }])).toMatchObject({ code: "painel:periodo-fora-do-ano" });
  });
  it("ficha única por INEP, só leitura, ausente = não registrado", () => {
    const r = { schoolId: "s1", inep: "33000000", name: "E.M. X", address: null, offers: [], shifts: ["manhã"], team: [], history: [] };
    const f = schoolFicha([r], "33000000");
    expect(f.ok && f.ficha).toMatchObject({ address: "não registrado", offers: "não registrado", editableHere: false });
    expect(schoolFicha([r, { ...r, schoolId: "s2" }], "33000000")).toMatchObject({ code: "ficha:inep-duplicado" });
  });
  it("diagnóstico só de métricas lidas, com evidência e link", () => {
    const v = [metricView(def("aulas-descobertas"), { ok: true, data: { value: 3, asOf: "d" } }, ctx), metricView(def("servidores"), undefined, ctx)];
    const d = diagnose(v, null);
    expect(d.findings.map((x) => x.id)).toEqual(["aulas-descobertas", "fonte:servidores"]);
    expect(d.findings.every((x) => x.evidence && x.link)).toBe(true);
    expect(d.note).toMatch(/não homologada/);
  });
});
