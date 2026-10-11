import { describe, expect, it } from "vitest";
import { detectIntegrity, type IntegrityInputs } from "./integrity-catalog";

const base: IntegrityInputs = { referenceDate: "2026-10-11", periods: [], people: [], schools: [], required: [], sourceCounts: [] };
const ids = (i: IntegrityInputs, rule: string) => detectIntegrity(i).findings.filter((f) => f.ruleId === rule).map((f) => f.entityId);

describe("integridade canônica", () => {
  it("fonte não lida é não verificável, sem achado", () => {
    const r = detectIntegrity({ ...base, people: null });
    expect(r.unverifiable).toContain("pessoa-possivel-duplicata");
    expect(r.findings).toHaveLength(0);
  });
  it("vigência invertida", () => {
    expect(ids({ ...base, periods: [{ id: "m1", validFrom: "2026-03-01", validUntil: "2026-02-01" }, { id: "m2", validFrom: "2026-03-01", validUntil: null }] }, "vigencia-invertida")).toEqual(["m1"]);
  });
  it("nascimento no futuro", () => {
    expect(ids({ ...base, people: [{ id: "p", name: "A", birthDate: "2027-01-01" }] }, "nascimento-impossivel")).toEqual(["p"]);
  });
  it("duplicata por nome sem acento + nascimento, só candidata", () => {
    const f = detectIntegrity({ ...base, people: [{ id: "b", name: "José  Silva", birthDate: "2015-05-05" }, { id: "a", name: "jose silva", birthDate: "2015-05-05" }, { id: "c", name: "jose silva", birthDate: "2015-05-06" }] }).findings;
    expect(f).toEqual([expect.objectContaining({ ruleId: "pessoa-possivel-duplicata", entityId: "a+b", evidence: { candidatos: 2, decisao: "manual" } })]);
  });
  it("INEP inválido e repetido", () => {
    const i = { ...base, schools: [{ id: "s1", inep: "33012345" }, { id: "s2", inep: "33012345" }, { id: "s3", inep: "123" }] };
    expect(ids(i, "inep-invalido")).toEqual(["s3"]);
    expect(ids(i, "inep-repetido")).toEqual(["33012345"]);
  });
  it("divergência exige duas fontes lidas; ausente não vira zero", () => {
    expect(ids({ ...base, sourceCounts: [{ schoolId: "s", measure: "alunos", bySource: { semed: 10, educacenso: null } }] }, "divergencia-entre-fontes")).toEqual([]);
    expect(ids({ ...base, sourceCounts: [{ schoolId: "s", measure: "alunos", bySource: { semed: 10, educacenso: 12 } }] }, "divergencia-entre-fontes")).toEqual(["s:alunos"]);
  });
});
