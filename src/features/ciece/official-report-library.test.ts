import { describe, expect, it } from "vitest";
import { toCsv } from "@/features/reports/report-engine";
import { CIECE_LIBRARY, runLibraryReport, historicoRows, pendenciasRows, situacaoRows } from "./official-report-library";
import { buildSnapshot } from "./historical-snapshots";
import { openCases } from "./correction-desk";
import { audit } from "./quality-auditor";

const caps = new Set(["consultar-ciece"]);
describe("CIECE L13 biblioteca de relatórios", () => {
  it("cobre os 13 relatórios pedidos, com metodologia e PDF/XLSX/CSV", () => {
    expect(CIECE_LIBRARY).toHaveLength(13);
    for (const e of CIECE_LIBRARY) { expect(e.methodology.length).toBeGreaterThan(0); if (e.def.id !== "ficha-longitudinal-aluno") expect(e.def.formats).toEqual(expect.arrayContaining(["pdf", "xlsx", "csv"])); }
    expect(CIECE_LIBRARY.find((e) => e.def.id === "ficha-longitudinal-aluno")!.def.formats).toEqual(["csv"]);
    expect(CIECE_LIBRARY.filter((e) => e.reused).map((e) => e.def.id)).toHaveLength(4);
  });
  it("sem capacidade recusa; histórico reproduzível com digest e ausência como 'não disponível'", () => {
    const s = buildSnapshot({ year: "2026", stageKey: "matricula-inicial", referenceDate: "2026-05-27", ruleRef: "mi@1" },
      [{ factId: "1", personId: "p", enrollmentId: "m", schoolId: "A", classId: null, validFrom: "2026-02-01", validTo: null, version: 1, recordedAt: "2026-03-01" }], [{ name: "x", sha256: "h", knownAt: "2026-06-01" }], "2026-06-01", "x");
    expect(() => runLibraryReport("ciece-historico", { year: 2026 }, historicoRows([s]), new Set())).toThrow("sem-capacidade");
    const now = new Date("2026-10-11T00:00:00Z");
    const a = runLibraryReport("ciece-historico", { year: 2026 }, historicoRows([s]), caps, now);
    const b = runLibraryReport("ciece-historico", { year: 2026 }, historicoRows([s]), caps, now);
    expect(toCsv(a.result, { headerLines: [], title: "t" }, a.meta)).toBe(toCsv(b.result, { headerLines: [], title: "t" }, b.meta));
    expect(a.meta.some((m) => m.startsWith("Metodologia:"))).toBe(true);
    expect(toCsv(a.result, { headerLines: [], title: "t" })).toContain("não disponível"); // substitui = null
  });
  it("pendências e situação censitária vêm das projeções, sem prazo inventado", () => {
    const cs = openCases(audit({ enrollments: [{ id: "m1", studentId: "s", schoolId: "e", yearId: "y", openedOn: null, hasAllocation: true, author: "x" }] })).cases;
    const r = runLibraryReport("ciece-pendencias", { knownAt: "2026-10-11T00:00:00Z" }, pendenciasRows(cs), caps);
    expect(r.result.rows[0]).toContain("secretaria"); expect(r.result.rows[0]![6]).toBeNull();
    const s = situacaoRows("e1", "matricula-inicial", [{ id: "a", label: "x", status: "nao-verificavel", evidence: "fonte não lida" }]);
    expect(s[0]!["prontidao"]).toBe("inconclusiva");
  });
});
