import { describe, expect, it } from "vitest";
import { actorLabel, explainCapability, governanceMatrix, type Engagement } from "./governance-station";

const pol = { id: "p", status: "homologada", validFrom: "2026-01-01", validUntil: null };
const rules = [{ engagement_kind_id: "direcao", capability_id: "x", scope_dimensions: ["school"] }];
const eng = (o: Partial<Engagement> = {}): Engagement => ({ id: "e", kindId: "direcao", validFrom: "2026-01-01", validUntil: null, endedOn: null, scopeLevel: "escola", schoolId: "s1", ...o });

describe("AN", () => {
  it("concede só com política homologada, regra, atuação vigente e escopo", () => {
    expect(explainCapability({ policy: pol, rules, engagements: [eng()], capabilityId: "x", on: "2026-05-01", schoolId: "s1" }).allowed).toBe(true);
  });
  it("rascunho, sem regra, sem atuação, outra escola, alcance ampliado ⇒ recusa", () => {
    const base = { rules, engagements: [eng()], capabilityId: "x", on: "2026-05-01", schoolId: "s1" };
    expect(explainCapability({ ...base, policy: { ...pol, status: "draft" } }).allowed).toBe(false);
    expect(explainCapability({ ...base, policy: pol, capabilityId: "y" }).allowed).toBe(false);
    expect(explainCapability({ ...base, policy: pol, engagements: [eng({ endedOn: "2026-02-01" })] }).allowed).toBe(false);
    expect(explainCapability({ ...base, policy: pol, schoolId: "s2" }).allowed).toBe(false);
    expect(explainCapability({ ...base, policy: pol, engagements: [eng({ scopeLevel: "rede" })] }).allowed).toBe(false);
  });
  it("ato sem regra fica pendente, nunca do administrador", () => {
    expect(governanceMatrix([]).every((a) => a.pending)).toBe(true);
  });
  it("automação nunca vira autor humano", () => {
    expect(actorLabel({ personId: null })).toMatch(/técnico/);
    expect(actorLabel({ personId: "p", technical: true })).toMatch(/técnico/);
  });
});
