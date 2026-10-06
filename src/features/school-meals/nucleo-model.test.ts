import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classify, FORBIDDEN_METRICS, INDICATORS, indicators, workQueue } from "./nucleo-model";
import { REPORTS } from "@/features/reports/report-registry";
import { REPORT_META } from "@/features/reports/report-catalog";

const sql = readFileSync("drizzle/migrations/0187_nae6_meal_network_workstation.sql", "utf8");

describe("NAE.6 Central do Núcleo", () => {
  it("zero lido ≠ desconhecido ≠ bloqueado", () => {
    expect(classify({ key: "x", value: 0, state: "AVAILABLE", reason: null }).state).toBe("ZERO");
    expect(classify(undefined).state).toBe("UNKNOWN");
    expect(classify({ key: "x", value: null, state: "AVAILABLE", reason: null }).state).toBe("UNKNOWN");
    const b = classify({ key: "adesao", value: null, state: "BLOCKED", reason: "ADHESION_METRIC — BLOCKED_BY_HOMOLOGATED_RULE" });
    expect(b).toEqual({ state: "BLOCKED", value: null, reason: "ADHESION_METRIC — BLOCKED_BY_HOMOLOGATED_RULE" });
  });
  it("sem leitura, todo indicador é UNKNOWN e a fila fica vazia", () => {
    const i = indicators(null);
    expect(i.every((x) => x.state === "UNKNOWN" && x.value === null)).toBe(true);
    expect(workQueue(i)).toEqual([]);
  });
  it("fila só com contagens positivas", () => {
    const i = indicators([{ key: "entregas-atrasadas", value: 3, state: "AVAILABLE", reason: null }, { key: "pedidos-submetidos", value: 0, state: "AVAILABLE", reason: null }]);
    expect(workQueue(i).map((x) => x.key)).toEqual(["entregas-atrasadas"]);
  });
  it("adesão e métricas normativas não são calculadas", () => {
    expect(sql).toMatch(/'adesao', NULL::bigint, 'BLOCKED'/);
    for (const k of FORBIDDEN_METRICS.filter((k) => k !== "adesao")) expect(Object.keys(INDICATORS)).not.toContain(k);
    expect(sql).not.toMatch(/\* ?100/);
  });
  it("central só lê: sem INSERT/UPDATE/DELETE, leitores exigem capability de rede, sem anon", () => {
    expect(sql).not.toMatch(/\b(INSERT INTO|UPDATE public|DELETE FROM)\b/);
    expect(sql.match(/meal_network_grant_on\('acompanhar-alimentacao-rede'/g)).toHaveLength(3);
    expect(sql).toMatch(/FROM PUBLIC, anon, service_role/);
  });
  it("relatórios novos estão no gerador e catalogados", () => {
    for (const id of ["execucao-alimentacao", "trilha-alimentacao", "qualidade-alimentacao"]) {
      expect(REPORTS.some((r) => r.id === id)).toBe(true);
      expect(REPORT_META[id]).toBeDefined();
    }
  });
});
