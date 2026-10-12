import { describe, expect, it } from "vitest";
import { ENROLLMENT_REPORTS, exportEnrollmentReport, runEnrollmentReport } from "./enrollment-reports";

const req = { params: { asOf: "2026-10-01", knownAt: "2026-10-12T00:00:00Z", scope: "rede" } };

describe("L23 relatórios", () => {
  it("são 22, únicos, com fonte, metodologia e três formatos", () => {
    expect(ENROLLMENT_REPORTS).toHaveLength(22);
    expect(new Set(ENROLLMENT_REPORTS.map((r) => r.id)).size).toBe(22);
    for (const r of ENROLLMENT_REPORTS) { expect(r.source).toBeTruthy(); expect(r.methodology).toBeTruthy(); expect(r.formats).toEqual(["csv", "xlsx", "pdf"]); }
  });
  it("exige data de referência, recusa simulação e dependência, mantém ausência", () => {
    expect(() => runEnrollmentReport("oferta-escolar", { params: { knownAt: "2026-10-12T00:00:00Z", scope: "rede" } }, [])).toThrow();
    expect(() => runEnrollmentReport("oferta-escolar", req, [], { simulated: true })).toThrow("simulation");
    expect(() => runEnrollmentReport("quadro-vagas", req, [])).toThrow("indisponível");
    const { def, result } = runEnrollmentReport("oferta-escolar", req, [{ escola: "E1", valor: null }]);
    expect(result.rows[0]).toContain("valor não disponível na fonte");
    expect(result.columns.some((c) => c.id === "protocolo")).toBe(false);
    const csv = exportEnrollmentReport(def, result, { headerLines: [], title: def.title }, "csv");
    expect(csv).toContain("Metodologia:"); expect(csv).toContain("2026-10-01");
  });
});

