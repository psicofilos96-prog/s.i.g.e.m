import { describe, expect, it } from "vitest";
import { parseNetworkReading, natureLabel, qualityFindings, indicatorRows, INDICADORES_REDE } from "./network-indicator-runtime";
import { NETWORK_INDICATORS } from "./network-indicator-catalog";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { reportById } from "@/features/reports/report-registry";
import { readFileSync } from "node:fs";

const raw = (ind: Record<string, unknown>) => ({ as_of: "2026-10-01", known_at: "x", school: null, year: null, indicators: ind });
const def = (k: string) => NETWORK_INDICATORS.find((d) => d.key === k)!;

describe("AD.2 leitura dos indicadores", () => {
  it("estados distintos; ausência nunca vira zero", () => {
    const r = parseNetworkReading(raw({
      "escolas-ativas": { state: "available", value: 55, source: "s" },
      "matriculas-vigentes": { state: "unknown", reason: "sem início efetivo", source: "e" },
      "blocos-ofertados": { state: "zero", value: 0, reason: "provado", source: "b" },
      "infraestrutura-declarada": { state: "available", value: 0 },
      "aulas-registradas": { state: "zero", value: 3 },
    }));
    const g = (k: string) => r.indicators.find((i) => i.key === k)!;
    expect(g("escolas-ativas")).toMatchObject({ state: "available", value: 55 });
    expect(g("matriculas-vigentes")).toMatchObject({ state: "unknown", value: null });
    expect(g("blocos-ofertados")).toMatchObject({ state: "zero", value: 0 });
    expect(g("infraestrutura-declarada").state).toBe("unknown");
    expect(g("aulas-registradas").state).toBe("unknown");
    expect(g("mapa-oficial")).toMatchObject({ state: "unavailable", value: null });
    expect(r.indicators).toHaveLength(NETWORK_INDICATORS.length);
  });
  it("oficial só com versão oficializada; dinâmico nunca oficial", () => {
    const r = parseNetworkReading(raw({ "mapa-oficial": { state: "unavailable", reason: "sem versão" }, "aulas-registradas": { state: "available", value: 2 } }));
    expect(natureLabel(def("mapa-oficial"), r.indicators.find((i) => i.key === "mapa-oficial")!)).not.toBe("Oficial");
    expect(natureLabel(def("aulas-registradas"), r.indicators.find((i) => i.key === "aulas-registradas")!)).not.toMatch(/Oficial/);
    for (const row of indicatorRows(r)) if (row.indicador !== def("mapa-oficial").name) expect(String(row.natureza)).not.toMatch(/^Oficial/);
  });
  it("qualidade lista lacunas sem julgar desempenho", () => {
    const q = qualityFindings(parseNetworkReading(raw({ "matriculas-vigentes": { state: "unknown", reason: "Sua atuação não autoriza" }, "escolas-ativas": { state: "available", value: 1 } })));
    expect(q.find((x) => x.key === "matriculas-vigentes")?.kind).toBe("nao-autorizado");
    expect(q.find((x) => x.key === "mapa-oficial")?.kind).toBe("pendente-oficializacao");
    expect(q.some((x) => x.key === "escolas-ativas")).toBe(false);
    expect(q.map((x) => x.text).join(" ")).not.toMatch(/ranking|desempenho ruim|risco/i);
  });
  it("exportação pelo motor comum, catalogada, com mesmos estados", () => {
    expect(reportById("indicadores-da-rede")).toBe(INDICADORES_REDE);
    const r = parseNetworkReading(raw({ "escolas-ativas": { state: "available", value: 55, source: "s" } }));
    const csv = toCsv(runReport(INDICADORES_REDE, { params: {} }, indicatorRows(r)), { headerLines: ["SIGEM"], title: "t" });
    expect(csv).toContain("Escolas ativas"); expect(csv).toContain("Indisponível"); expect(csv).toContain("não disponível");
  });
  it("sem escrita operacional nem limiar inventado", () => {
    const src = readFileSync("src/features/dashboards/network-indicator-runtime.ts", "utf8") + readFileSync("src/features/dashboards/executive-dashboard-page.tsx", "utf8");
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(src).not.toMatch(/minGroup\s*[:=]\s*\d/);
    const sql = readFileSync("drizzle/migrations/0160_ad2_indicators_unknown_without_start.sql", "utf8");
    expect(sql).toMatch(/STABLE/); expect(sql).not.toMatch(/SECURITY DEFINER/); expect(sql).not.toMatch(/\b(INSERT INTO|UPDATE public|DELETE FROM)\b/);
  });
  it("desempenho: parse de 12 indicadores com 55 escolas é imediato", () => {
    const by = Object.fromEntries(Array.from({ length: 55 }, (_, n) => [`s${n}`, n + 1]));
    const t = performance.now();
    for (let n = 0; n < 500; n++) parseNetworkReading(raw(Object.fromEntries(NETWORK_INDICATORS.map((d) => [d.key, { state: "available", value: 9, breakdown: { escola: by } }]))));
    expect(performance.now() - t).toBeLessThan(500);
  });
});
