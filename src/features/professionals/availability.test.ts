import { describe, expect, it } from "vitest";
import { availabilityOn, eligibility, type AvailabilityInput } from "./availability";

const D = "2026-03-02";
const base: AvailabilityInput = {
  linkLogicalId: "L1", contractualMinutes: 1800, exercising: true,
  commitments: [{ id: "A1", source: "atribuicao", minutes: 600, schoolId: "E1", validFrom: "2026-02-01", validUntil: null, slots: ["seg-1"] }],
  leaves: [], restrictions: [], effectRules: [],
};

describe("disponibilidade", () => {
  it("total, comprometida e livre", () => {
    expect(availabilityOn(base, D)).toMatchObject({ total: 1800, committed: 600, free: 1200, conflicts: [] });
  });
  it("sem jornada contratual ⇒ total e livre indeterminados", () => {
    const a = availabilityOn({ ...base, contractualMinutes: null }, D);
    expect(a.total).toBeNull(); expect(a.free).toBeNull();
    expect(a.pending).toContain("jornada contratual não registrada");
  });
  it("afastamento sem regra homologada não reduz: fica indeterminado", () => {
    const a = availabilityOn({ ...base, leaves: [{ id: "F1", kind: "licenca-saude", actRef: "ato", validFrom: "2026-03-01", validUntil: "2026-03-10" }] }, D);
    expect(a.free).toBeNull();
    expect(a.pending).toContain("licenca-saude: sem regra de efeito homologada");
  });
  it("afastamento total homologado zera capacidade e sinaliza compromisso", () => {
    const a = availabilityOn({ ...base, leaves: [{ id: "F1", kind: "licenca", actRef: "ato", validFrom: "2026-03-01", validUntil: null }], effectRules: [{ kind: "licenca", capacityFactor: 1, homologated: true }] }, D);
    expect(a.total).toBe(0);
    expect(a.conflicts.map((c) => c.kind)).toEqual(expect.arrayContaining(["compromisso-durante-afastamento", "excede-capacidade"]));
  });
  it("horário sobreposto é conflito", () => {
    const a = availabilityOn({ ...base, commitments: [...base.commitments, { id: "A2", source: "designacao", minutes: 100, schoolId: "E2", validFrom: "2026-01-01", validUntil: null, slots: ["seg-1"] }] }, D);
    expect(a.conflicts).toContainEqual({ kind: "horario-sobreposto", refs: ["A1", "A2"] });
  });
});

describe("elegibilidade", () => {
  const offer = { componentId: "MAT", minutes: 300, slots: ["ter-1"], schoolId: "E1" };
  const q = [{ componentId: "MAT", validatedBy: "u2", validFrom: "2020-01-01", validUntil: null }];
  it("elegível com habilitação validada, ato e capacidade", () => {
    expect(eligibility(base, D, offer, q, "port-1")).toEqual([]);
  });
  it("capacidade livre não basta: exige habilitação e ato", () => {
    expect(eligibility(base, D, offer, [], null)).toEqual(expect.arrayContaining(["sem-habilitacao", "sem-ato"]));
    expect(eligibility(base, D, offer, [{ ...q[0]!, validatedBy: null }], "p")).toContain("habilitacao-nao-validada");
  });
  it("horário ocupado e capacidade insuficiente", () => {
    expect(eligibility(base, D, { ...offer, slots: ["seg-1"], minutes: 5000 }, q, "p")).toEqual(expect.arrayContaining(["conflito-de-horario", "capacidade-insuficiente"]));
  });
});
