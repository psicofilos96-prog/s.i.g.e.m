import { describe, expect, it } from "vitest";
import { assertAggregateOnly, assertNonDiscriminatoryCriteria, assertRefusalReasonAllowed, planGaps } from "./accessibility-planning";

const needs = [
  { schoolId: "E1", resourceType: "rampa", count: 7 as const },
  { schoolId: "E1", resourceType: "transporte-acessivel", count: "suprimido" as const },
  { schoolId: "E2", resourceType: "rampa", count: null },
  { schoolId: "E2", resourceType: "sala-recursos", count: 6 as const },
];
const infra = [{ schoolId: "E1", resources: { rampa: false } }, { schoolId: "E2", resources: { "sala-recursos": null } }];

describe("Acessibilidade L19", () => {
  it("lacunas a partir de agregados, ficha e frota; não informado ≠ ausente", () => {
    const g = planGaps(needs, infra, [{ schoolId: "E1", accessibleVehicles: 0 }], "transporte-acessivel");
    expect(g.map((x) => `${x.schoolId}:${x.resourceType}:${x.status}`)).toEqual([
      "E1:rampa:lacuna", "E1:transporte-acessivel:lacuna", "E2:rampa:indeterminado", "E2:sala-recursos:indeterminado"]);
    expect(planGaps(needs.slice(1, 2), [], [], "transporte-acessivel")[0]?.status).toBe("indeterminado");
  });
  it("recusa dado individual, termo clínico e contagem pequena não suprimida", () => {
    expect(() => assertAggregateOnly([{ schoolId: "E", resourceType: "rampa", count: 9, studentId: "x" }])).toThrow();
    expect(() => assertAggregateOnly([{ schoolId: "E", resourceType: "laudo-tea", count: 9 }])).toThrow();
    expect(() => assertAggregateOnly([{ schoolId: "E", resourceType: "rampa", count: 2 }])).toThrow();
  });
  it("necessidade de apoio nunca é critério de vaga nem motivo de recusa", () => {
    expect(() => assertNonDiscriminatoryCriteria([{ factKey: "irmao-na-escola", label: "Irmão", effect: "prioridade" }])).not.toThrow();
    expect(() => assertNonDiscriminatoryCriteria([{ factKey: "atendimento-aee", label: "AEE", effect: "excluir" }])).toThrow();
    expect(() => assertRefusalReasonAllowed("Escola sem estrutura para necessidade de apoio")).toThrow();
    expect(() => assertRefusalReasonAllowed("Fora do período da campanha")).not.toThrow();
  });
});
