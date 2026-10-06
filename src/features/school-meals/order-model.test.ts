import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { anomalies, ceilingVerdict, classifyZero, computeCeiling, consolidate, orderReportRow, schoolCanEdit, type CalcInputs } from "./order-model";
import { REPORTS } from "@/features/reports/report-registry";
import { CATALOG } from "@/features/reports/report-catalog";

const dir = "drizzle/migrations";
const sql = readFileSync(`${dir}/${readdirSync(dir).find((f) => f.startsWith("0183_"))}`, "utf8");
const writer = sql.slice(sql.indexOf("CREATE FUNCTION public.record_meal_order("), sql.indexOf("-- parecer técnico"));

const base: CalcInputs = {
  rule: { ref: "regra-sintetica", version: 1, homologated: true, discountStock: true, unitRef: "g" },
  perCapita: { value: { quantity: 50, unitRef: "g" }, ref: "pc", version: 2 },
  population: { value: 100, ref: "matriculas", version: 1 },
  schoolDays: { value: 20, ref: "calendario", version: 3 },
  stock: { value: { quantity: 30, unitRef: "kg", basis: "inventario validado 2027-02-20" }, ref: "estoque", version: 1 },
  conversions: [{ from: "kg", to: "g", factor: 1000, ref: "conv", version: 1 }],
};

describe("NAE.2 — motor explicável", () => {
  it("regra sintética homologada aplica e registra manifesto completo", () => {
    const r = computeCeiling(base);
    expect(r.state).toBe("CALCULATED");
    if (r.state !== "CALCULATED") return;
    expect(r.need).toBe(100000); expect(r.ceiling).toBe(70000);
    expect(r.manifest.rule).toBe("regra-sintetica@v1");
    expect(Object.keys(r.manifest.inputs).sort()).toEqual(["perCapita", "population", "schoolDays", "stock"]);
    expect(r.manifest.conversions).toEqual(["conv@v1"]);
  });
  it("regra ausente/não homologada = UNKNOWN, nunca zero; veredito não calculável", () => {
    const r = computeCeiling({ ...base, rule: null });
    expect(r).toEqual({ state: "UNKNOWN", reason: "QUANTITY_LIMIT — BLOCKED_BY_HOMOLOGATED_RULE" });
    expect(ceilingVerdict(0, r)).toBe("nao-calculavel");
    expect(computeCeiling({ ...base, rule: { ...base.rule!, homologated: false } }).state).toBe("UNKNOWN");
  });
  it("conversão ausente recusa cálculo", () => {
    const r = computeCeiling({ ...base, conversions: [] });
    expect(r.state === "UNKNOWN" && r.reason).toBe("UNIT_CONVERSION — BLOCKED_BY_HOMOLOGATED_RULE");
  });
  it("zero com justificativa não vira demanda; anomalia só com regra configurada", () => {
    expect(classifyZero({ item_ref: "a", unidade_ref: "u", quantidade: 0, zero_motivo: "saldo-suficiente" })).toBe("zero-justificado");
    const lines = [{ item_ref: "a", unidade_ref: "u", quantidade: 0 }];
    expect(anomalies(lines, {}, [])).toEqual([]);
    expect(anomalies(lines, {}, [{ id: "z", kind: "zero-sem-justificativa", homologated: true }])).toHaveLength(1);
    expect(anomalies(lines, {}, [{ id: "z", kind: "zero-sem-justificativa", homologated: false }])).toHaveLength(0);
  });
  it("consolidação exclui rascunho/rejeitado/zero e mantém destino", () => {
    const L = (q: number) => [{ item_ref: "a", unidade_ref: "u", quantidade: q }];
    const c = consolidate([
      { id: "1", school: "A", status: "autorizado-total", lines: L(5) },
      { id: "2", school: "B", status: "autorizado-parcial", lines: L(3) },
      { id: "3", school: "C", status: "rascunho", lines: L(100) },
      { id: "4", school: "D", status: "rejeitado", lines: L(100) },
      { id: "5", school: "E", status: "retificado", lines: L(0) },
    ]);
    expect(c).toEqual([{ key: "a|u||", total: 8, bySchool: { A: 5, B: 3 } }]);
  });
  it("submissão congela edição da escola; relatório solicitado × autorizado", () => {
    expect(schoolCanEdit("submetido")).toBe(false); expect(schoolCanEdit("devolvido")).toBe(true);
    const row = orderReportRow("A", [
      { version: 1, status: "rascunho", lines: [], recorded_at: "2027-01-10T10:00:00Z" },
      { version: 2, status: "submetido", lines: [{ item_ref: "a", unidade_ref: "u", quantidade: 10 }], recorded_at: "2027-01-15T10:00:00Z" },
      { version: 3, status: "autorizado-parcial", lines: [{ item_ref: "a", unidade_ref: "u", quantidade: 7 }], recorded_at: "2027-01-16T10:00:00Z" },
    ]);
    expect(row).toMatchObject({ requested: 10, authorized: 7, analysisHours: 24, versions: 3 });
    expect(REPORTS.some((r) => r.id === "pedidos-alimentacao")).toBe(true);
    expect(CATALOG.some((c) => c.id === "consolidado-demanda-alimentacao")).toBe(true);
  });
});

describe("NAE.2 — SQL governado", () => {
  it("janela sem dia fixo, com fuso explícito e reabertura versionada com motivo", () => {
    expect(sql).not.toMatch(/23:59:59|dia 15|dia 20|EXTRACT\(DAY/i);
    expect(sql).toContain("'meal:time-zone-required'");
    expect(sql).toContain("'reabertura'");
    expect(sql).toContain("'meal:window-rule-not-homologated'");
  });
  it("submissão congela, stale, escola só via meal_grant_on da própria escola", () => {
    expect(writer).toContain("'meal:order-frozen'");
    expect(writer).toContain("'meal:stale'");
    expect(writer).toContain("'meal:window-closed'");
    expect(writer).toContain("meal_grant_on('submeter-pedido-alimentar', _school, d)");
    expect(writer).toContain("_school := head.school_id"); // IDOR: escola vem da base, não da requisição
  });
  it("item vedado e unidade não homologada recusados no writer", () => {
    expect(sql).toContain("'meal:item-not-eligible-for-audience'");
    expect(sql).toContain("'meal:audience-required'");
    expect(sql).toContain("'meal:unit-not-homologated'");
  });
  it("autorizado imutável (append-only) e retificação justificada; consolidação só autorizados > 0", () => {
    expect(sql).toContain("meal_order_versions_append_only");
    expect(writer).toMatch(/retificacao[\s\S]*reason-required/);
    expect(sql).toContain("h.status IN ('autorizado-total','autorizado-parcial','retificado') AND (x->>'quantidade')::numeric > 0");
    expect(sql).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)\s+ON\s+(TABLE\s+)?public\./i);
    expect(sql).not.toMatch(/TO (anon|PUBLIC)/);
  });
});
