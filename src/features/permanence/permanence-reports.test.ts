import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { PERMANENCE_REPORTS, countBy, runPermanenceReport, exportPermanenceReport, EXPORT_CAP, NOMINAL_CAP } from "./permanence-reports";

const req = { params: { asOf: "2026-10-12", knownAt: "2026-10-12T10:00:00Z", scope: "escola" } };
const brand = { headerLines: ["SIGEM"], title: "Teste" };

describe("L22 relatórios da Permanência", () => {
  it("20 relatórios com fonte existente, metodologia e unidade", () => {
    expect(PERMANENCE_REPORTS).toHaveLength(20);
    expect(new Set(PERMANENCE_REPORTS.map((r) => r.id)).size).toBe(20);
    for (const r of PERMANENCE_REPORTS) {
      for (const f of r.source.split(" + ")) expect(existsSync(`src/features/permanence/${f}`), f).toBe(true);
      expect(r.methodology.length).toBeGreaterThan(20);
      expect(r.params.find((p) => p.id === "asOf")?.required).toBe(true);
    }
  });
  it("alertas, casos e estudantes únicos contam separado", () => {
    const rows = [{ alertId: "a1", caseId: "c1", studentRef: "s1" }, { alertId: "a2", caseId: "c1", studentRef: "s1" }, { alertId: "a3", caseId: "c2", studentRef: "s1" }];
    expect([countBy("alerta", rows), countBy("caso", rows), countBy("estudante-unico", rows)]).toEqual([3, 2, 1]);
  });
  it("nominal e exportação exigem capacidade; dependência recusa execução", async () => {
    expect(() => runPermanenceReport("casos-abertos", { ...req, includeSensitive: true }, [], new Set())).toThrow("nominal-not-authorized");
    const { def, result } = runPermanenceReport("casos-abertos", req, [{ escola: "E1", valor: 3 }], new Set());
    await expect(exportPermanenceReport(def, result, brand, "csv", new Set())).rejects.toThrow("export-not-authorized");
    const csv = await exportPermanenceReport(def, result, brand, "csv", new Set([EXPORT_CAP]));
    expect(String(csv)).toContain("Unidade de contagem: caso");
    expect(() => runPermanenceReport("alertas-emitidos", req, [], new Set([NOMINAL_CAP]))).toThrow();
  });
  it("sem data de referência não executa; ausência não vira zero", () => {
    expect(() => runPermanenceReport("casos-abertos", { params: { scope: "escola" } }, [], new Set())).toThrow();
    const { result } = runPermanenceReport("retornos", req, [{ escola: "E1" }], new Set());
    expect(result.rows[0]![result.columns.findIndex((c) => c.id === "valor")]).toBeNull();
  });
});
