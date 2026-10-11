import { describe, it, expect } from "vitest";
import { networkRegularity, recordConference, conferencePanel, type NetworkInput } from "./supervision-regularity";

const base: NetworkInput = { secretariatRows: [], spans: [], classes: [], results: [], calendars: [], movements: [] };

describe("auditor de regularidade da rede", () => {
  it("sinaliza indícios só nas escolas visíveis, sem corrigir", () => {
    const r = networkRegularity({
      ...base,
      spans: [
        { studentId: "s1", enrollmentId: "a", schoolId: "E1", start: "2026-02-01", end: null },
        { studentId: "s1", enrollmentId: "b", schoolId: "E2", start: "2026-05-01", end: null },
      ],
      calendars: [{ schoolId: "E1", applicableIds: ["c1", "c2"] }, { schoolId: "E3", applicableIds: [] }],
      movements: [{ studentId: "s2", schoolId: "E1", enrollmentId: "x", date: "2026-01-10", enrollmentStart: "2026-02-01", enrollmentEnd: null }],
    }, ["E1"]);
    const codes = r.indications.map((i) => `${i.schoolId}:${i.code}`);
    expect(codes).toContain("E1:matriculas-sobrepostas");
    expect(codes).toContain("E1:calendarios-divergentes");
    expect(codes).toContain("E1:movimentacao-fora-da-vigencia");
    expect(codes.some((c) => c.startsWith("E2") || c.startsWith("E3"))).toBe(false);
    expect(r.indications.every((i) => i.nature === "indicio" && i.autoFix === false)).toBe(true);
  });
  it("dado ausente é não verificável, nunca indício", () => {
    const r = networkRegularity({ ...base, classes: [{ classId: "t", schoolId: "E1", hasMatrix: null, hasTeacherForAll: true, hasSchedule: true }],
      results: [{ classId: "t", schoolId: "E1", periodClosed: null, resultsMissing: 3 }] }, ["E1"]);
    expect(r.indications).toHaveLength(0);
    expect(r.unverifiable.length).toBe(2);
  });
  it("resultados pendentes só após fechamento", () => {
    const r = networkRegularity({ ...base, results: [{ classId: "t", schoolId: "E1", periodClosed: false, resultsMissing: 3 }] }, ["E1"]);
    expect(r.indications).toHaveLength(0);
  });
});

describe("conferência de escrituração", () => {
  it("exige humano, competência, base e descrição do indício", () => {
    const ev = { schoolId: "E1", kind: "ata" as const, itemRef: "a1", principalId: "p", isHuman: true, level: "conferir", outcome: "indicio" as const, note: null };
    expect(recordConference([], ev, 0)).toEqual({ ok: false, code: "indicio-sem-descricao" });
    expect(recordConference([], { ...ev, level: "consultar", note: "x" }, 0)).toEqual({ ok: false, code: "sem-competencia" });
    expect(recordConference([], { ...ev, isHuman: false, note: "x" }, 0)).toEqual({ ok: false, code: "autor-nao-humano" });
    const ok = recordConference([], { ...ev, note: "folha sem assinatura" }, 0);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(recordConference(ok.value, { ...ev, note: "y" }, 0)).toEqual({ ok: false, code: "base-alterada" });
    const p = conferencePanel(ok.value, "E1", [{ kind: "ata", itemRef: "a1" }, { kind: "ata", itemRef: "a2" }]);
    const ata = p.find((x) => x.kind === "ata")!;
    expect(ata.pending).toBe(1);
    expect(ata.rows[0]!.state).toBe("indicio");
  });
});
