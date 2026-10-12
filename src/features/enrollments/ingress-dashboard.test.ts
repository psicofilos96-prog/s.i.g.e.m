import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { INGRESS_REPORTS, appealState, canRun, cellView, territorialView, totals, type DashboardRow } from "./ingress-dashboard";

const sql = readFileSync("drizzle/migrations/0476_enr23_dashboard_appeals.sql", "utf8");
const row = (o: Partial<DashboardRow>): DashboardRow => ({ cell_key: "e1|o|t", school_key: "e1", authorized: 10, reservations_active: 4, confirmed: 2, requests: 12, students: 9, enrollments: 1, read_at: "x", ...o });

describe("L23 painel, mapa, recursos e relatórios", () => {
  it("disponível e taxa só com dados lidos; sobreocupação visível", () => {
    expect(cellView(row({})).available).toBe(6);
    expect(cellView(row({ authorized: null })).available).toBeNull();
    expect(cellView(row({ authorized: 3 })).overbooked).toBe(true);
  });
  it("unidades separadas; total só com todas as linhas; estudantes não somam", () => {
    const t = totals([row({}), row({ cell_key: "e2|o|t", school_key: "e2", requests: 3 })]);
    expect(t).toMatchObject({ solicitacoes: 15, reservas: 8, matriculas: 2, vagas: 20, estudantes: null });
    expect(totals([row({}), row({ enrollments: null })]).matriculas).toBeNull();
  });
  it("mapa agregado sem limiar oculta demanda", () => {
    const places = [{ schoolId: "e1", name: "E1", districtCode: "01", location: { lat: -21.2, lng: -41.9, source: "inep" }, modalities: [], stages: [] }];
    const m = territorialView(places, [row({})], { minCellSize: null });
    expect(m.points[0]).toMatchObject({ authorized: 10, occupants: 4 });
    expect(m.districtDemand?.[0]?.demand).toBeNull();
    expect(territorialView(places, [row({ requests: 2 })], { minCellSize: 5 }).districtDemand?.[0]?.demand).toBe("suprimido");
  });
  it("recursos: estado = último evento; banco exige análise, ato, decisor ≠ autor, seq", () => {
    expect(appealState([{ appeal_id: "a", seq: 1, kind: "recurso", action: "registrar", person_id: "p", act_ref: null }, { appeal_id: "a", seq: 2, kind: "recurso", action: "analisar", person_id: "p", act_ref: null }])).toBe("em-analise");
    for (const k of ["'decisor-igual-autor'", "'sem-ato'", "'sem-analise'", "'versao-desatualizada'", "'ja-decidido'", "pg_advisory_xact_lock"]) expect(sql).toContain(k);
    expect(sql).toMatch(/doc_numbering_append_only/);
    expect(sql).toMatch(/FROM PUBLIC, anon/);
  });
  it("painel calcula na hora e não grava", () => {
    const dash = sql.slice(sql.indexOf("FUNCTION public.enr_ingress_dashboard"), sql.indexOf("CREATE TABLE"));
    expect(dash).toMatch(/STABLE/);
    expect(dash).not.toMatch(/INSERT|UPDATE/);
    expect(dash).toMatch(/'acompanhar-ocupacao-de-ingresso'/);
  });
  it("24 relatórios com fonte, metodologia, filtros, unidade; dependência bloqueia", () => {
    expect(INGRESS_REPORTS).toHaveLength(24);
    expect(new Set(INGRESS_REPORTS.map((r) => r.id)).size).toBe(24);
    for (const r of INGRESS_REPORTS) { expect(r.source).toBeTruthy(); expect(r.methodology.length).toBeGreaterThan(10); expect(r.filters.length).toBeGreaterThan(0); }
    for (const u of ["solicitacoes", "estudantes", "reservas", "matriculas"]) expect(INGRESS_REPORTS.some((r) => r.unit === u)).toBe(true);
    expect(canRun(INGRESS_REPORTS[23]!, new Set()).ok).toBe(false);
  });
});
