import { describe, expect, it } from "vitest";
import { declarationNumberLabel, declarationValidUntil, groupRenewal, renewalFingerprint } from "./movement-docs";

describe("declaração provisória de transferência", () => {
  it("vale 30 dias corridos por padrão", () => {
    expect(declarationValidUntil("2027-03-10", 30)).toBe("2027-04-09");
    expect(declarationValidUntil("2027-12-15", 30)).toBe("2028-01-14");
  });
  it("recusa validade inválida", () => {
    expect(() => declarationValidUntil("2027-03-10", 0)).toThrow();
  });
  it("número sequencial da escola no ano", () => expect(declarationNumberLabel(7, 2027)).toBe("007/2027"));
});

describe("rematrícula em lote", () => {
  const rows = [
    { student_id: "a", display_name: "A", decision: null, decision_sequence: null, resulting_enrollment_id: null },
    { student_id: "b", display_name: "B", decision: "renovou", decision_sequence: 1, resulting_enrollment_id: "m" },
    { student_id: "c", display_name: "C", decision: "transferido-saida", decision_sequence: 1, resulting_enrollment_id: null },
  ];
  it("separa prontos, já renovados e exceções", () => {
    const g = groupRenewal(rows);
    expect([g.prontos.length, g.renovados.length, g.excecoes.length]).toEqual([1, 1, 1]);
  });
  it("lista alterada muda a impressão digital", () => {
    const changed = rows.map((r) => (r.student_id === "a" ? { ...r, decision: "renovou", decision_sequence: 1 } : r));
    expect(renewalFingerprint(rows)).not.toBe(renewalFingerprint(changed));
  });
});
