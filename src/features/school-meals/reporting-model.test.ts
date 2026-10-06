import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classifyRep, drillFilter, REPORTING_REPORTS, toReportRow, FORBIDDEN_ROW_KEYS, type Dataset } from "./reporting-model";
import { REPORTS } from "@/features/reports/report-registry";
import { CATALOG } from "@/features/reports/report-catalog";

const sql = readFileSync("drizzle/migrations/0192_nae8_reporting_readers.sql", "utf8") + readFileSync("drizzle/migrations/0193_nae8_reporting_summary_single_pass.sql", "utf8");

describe("NAE.8 Lote 4 — Central e relatórios", () => {
  it("ausência nunca vira zero; zero só quando lido; bloqueio preserva motivo", () => {
    expect(classifyRep(undefined).state).toBe("UNKNOWN");
    expect(classifyRep({ dataset: "execucoes", key: "refeicoes-servidas", value: null, state: "UNKNOWN", reason: "x" })).toMatchObject({ state: "UNKNOWN", value: null });
    expect(classifyRep({ dataset: "entregas", key: "total", value: 0, state: "AVAILABLE", reason: null })).toMatchObject({ state: "ZERO", value: 0 });
    expect(classifyRep({ dataset: "bloqueios", key: "adesao", value: null, state: "BLOCKED", reason: "ADHESION_METRIC — BLOCKED_BY_HOMOLOGATED_RULE" }).reason).toContain("ADHESION");
  });
  it("filtro do drill-down reproduz o predicado do agregado", () => {
    expect(drillFilter("entregas", "pendente")).toEqual({ situacao: "pendente" });
    expect(drillFilter("movimentos", "perda")).toEqual({ classe: "perda" });
    expect(drillFilter("movimentos", "lote-ausente")).toEqual({ classe: "entrada-aceite", lote: "ausente" });
    expect(drillFilter("movimentos", "validade-informada")).toEqual({ classe: "entrada-aceite", validade: "informada" });
    expect(drillFilter("pedidos", "submetidos")).toEqual({ submetido: true });
    expect(drillFilter("execucoes", "refeicoes-servidas")).toBeNull();
  });
  it("entrega: integral, parcial, rejeitada e pendente distintas; lote ausente fica null", () => {
    const sit = (a: unknown) => toReportRow("entregas", "E", { programado: 10, aceito: a })["situation"];
    expect([sit(10), sit(4), sit(0), sit(null)]).toEqual(["integral", "parcial", "rejeitada", "pendente"]);
    expect(toReportRow("movimentos", "E", { classe: "entrada-aceite", lote: null, validade: null })).toMatchObject({ lot: null, expires: null });
  });
  it("refeições servidas e alunos presentes são colunas separadas", () => {
    expect(toReportRow("execucoes", "E", { refeicoes_servidas: 80, alunos_presentes: 95, seguido: false })).toMatchObject({ meals: 80, students: 95, followed: "desvio" });
  });
  it("todos os datasets estão no gerador canônico e na Central de relatórios, com CSV/XLSX/PDF", () => {
    for (const d of Object.values(REPORTING_REPORTS)) {
      expect(REPORTS.some((r) => r.id === d.id)).toBe(true);
      expect(CATALOG.some((c) => c.id === d.id)).toBe(true);
      expect(d.formats).toEqual(["csv", "xlsx", "pdf"]);
      expect(d.columns.map((c) => c.id)).not.toEqual(expect.arrayContaining([...FORBIDDEN_ROW_KEYS]));
    }
  });
  it("evidência no relatório não carrega caminho nem link", () => {
    const row = toReportRow("evidencias" as Dataset, "E", { storage_path: "x/y.png", signed_url: "https://x", sha256: "a" });
    expect(Object.values(row).join("|")).not.toMatch(/x\/y\.png|https/);
  });
  it("readers: DEFINER, search_path vazio, sem anon, sem DML, métricas normativas bloqueadas", () => {
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+(INTO|FROM)?\s*public\./i);
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*TO[^;]*anon/i);
    expect((sql.match(/SECURITY DEFINER SET search_path TO ''/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.meal_reporting_facts\(text, text, date, date\) FROM PUBLIC, anon, authenticated, service_role/);
    for (const k of ["ADHESION_METRIC", "WASTE_METRIC", "MINIMUM_STOCK", "COST_SOURCE"]) expect(sql).toContain(k);
    expect(sql).not.toMatch(/storage_path'\s*,/);
  });
});

import { runSemanticQuery } from "@/features/educational-intelligence/semantic-layer";
import { MEAL_EXECUTION_SEMANTIC, ANALYTICS_BLOCKED } from "./reporting-model";
describe("NAE.8 Lote 4 — handoff analítico", () => {
  it("soma só refeições informadas e não inventa métrica normativa", () => {
    const rows = [{ school: "A", date: "2026-10-01", slot: "almoço", followed: "desvio", meals: 80, students: 95 }, { school: "A", date: "2026-10-02", slot: "almoço", followed: "seguido", meals: null, students: null }];
    const r = runSemanticQuery(MEAL_EXECUTION_SEMANTIC, { datasetId: "nae-execucoes", measureId: "meals", aggregation: "soma", groupBy: ["school"], knownAt: "2026-10-06T00:00:00Z", asOf: null }, rows);
    expect(r.cells[0]?.value).toBe(80);
    expect(MEAL_EXECUTION_SEMANTIC.measures.map((m) => m.id)).not.toEqual(expect.arrayContaining([...ANALYTICS_BLOCKED]));
    expect(new Set(MEAL_EXECUTION_SEMANTIC.measures.map((m) => m.scaleKey)).size).toBe(2);
  });
});
