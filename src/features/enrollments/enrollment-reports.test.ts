import { describe, expect, it } from "vitest";
import { ENROLLMENT_REPORTS, exportEnrollmentReport, runEnrollmentReport } from "./enrollment-reports";
import { appendGed, gedCurrent, gedHistory, type GedVersion } from "./enrollment-ged";

const req = { params: { asOf: "2026-10-01", knownAt: "2026-10-12T00:00:00Z", scope: "rede" } };
const H = "a".repeat(64);

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

const v = (o: Partial<GedVersion>): GedVersion => ({ docId: "c1", version: 1, kind: "criterio", title: "Critério", contentHash: H, authorPersonId: "p1", authorIsTechnical: false, recordedAt: "2026-10-01T00:00:00Z", validFrom: "2026-10-01", event: "publicacao", justification: null, ...o });

describe("L23 GED", () => {
  it("append-only com autoria humana, histórico e revogação", () => {
    expect(() => appendGed(v({ authorIsTechnical: true }), [])).toThrow("executor técnico");
    let l = appendGed(v({}), []);
    expect(() => appendGed(v({ version: 2, event: "retificacao" }), l)).toThrow("justificativa");
    l = appendGed(v({ version: 2, event: "retificacao", justification: "erro material", recordedAt: "2026-10-05T00:00:00Z" }), l);
    expect(gedHistory("c1", l).map((x) => x.version)).toEqual([1, 2]);
    expect(gedCurrent("c1", l, "2026-10-10", "2026-10-02T00:00:00Z")?.version).toBe(1);
    l = appendGed(v({ version: 3, event: "revogacao", justification: "substituído" }), l);
    expect(gedCurrent("c1", l, "2026-10-10", "2026-10-12T00:00:00Z")).toBeNull();
  });
  it("decisão cita critério e tem autor distinto", () => {
    const l = appendGed(v({}), []);
    expect(() => appendGed(v({ docId: "d1", kind: "decisao", appliesCriterionDocId: "c1" }), l)).toThrow("autor da decisão");
    expect(appendGed(v({ docId: "d1", kind: "decisao", appliesCriterionDocId: "c1", authorPersonId: "p2" }), l)).toHaveLength(2);
  });
});
