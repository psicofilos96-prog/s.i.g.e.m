import { describe, expect, it } from "vitest";
import { bridge, type DeferredPlan, type MatrixItem } from "./staffing-bridge";

const plan: DeferredPlan = { proposalId: "pp1", kind: "abertura", decided: true, decisionActRef: "ato-1", decidedBy: "d", proposedBy: "p", schoolId: "E1", plannedClasses: [{ planKey: "k1", positionKey: "ano-6", shift: "manha", expectedStudents: 30 }] };
const matrix: MatrixItem[] = [
  { positionKey: "ano-6", componentId: "mat", weeklyLessons: 5, requiredQualification: "lic-mat", matrixVersionId: "mv1", homologated: true },
  { positionKey: "ano-6", componentId: "por", weeklyLessons: 5, requiredQualification: "lic-por", matrixVersionId: "mv1", homologated: true },
];

describe("Demanda → Gestão de Pessoas L20", () => {
  it("só proposta deferida com ato e decisor distinto; pacotes da matriz; nada é gravado", () => {
    const r = bridge([plan, { ...plan, proposalId: "pp2", decidedBy: "p" }], matrix, null);
    expect(r.packages.map((p) => `${p.componentId}:${p.weeklyLessons}`)).toEqual(["mat:5", "por:5"]);
    expect(r.totalWeeklyLessons).toBe(10);
    expect(r.rejected.map((x) => x.proposalId)).toEqual(["pp2"]);
    expect([r.writes.length, r.createsLinks, r.createsAssignments]).toEqual([0, false, false]);
    expect(JSON.stringify(r)).not.toMatch(/professores|teachersCount/);
  });
  it("matriz ausente, ambígua ou carga não declarada ⇒ indeterminado e total não fecha", () => {
    expect(bridge([plan], [], null).totalWeeklyLessons).toBeNull();
    expect(bridge([plan], [...matrix, { ...matrix[0]!, matrixVersionId: "mv2" }], null).packages[0]?.reason).toBe("Matriz ambígua.");
    expect(bridge([plan], [{ ...matrix[0]!, weeklyLessons: null }], null).totalWeeklyLessons).toBeNull();
  });
  it("apoio só por critério homologado; sem critério ⇒ null", () => {
    expect(bridge([plan], matrix, null).supportNeeds).toEqual([{ schoolId: "E1", needs: null }]);
    const r = bridge([plan], matrix, ({ newClasses }) => [{ area: "apoio-escolar", reference: newClasses, criterionVersion: "c1" }]);
    expect(r.supportNeeds[0]?.needs).toEqual([{ area: "apoio-escolar", reference: 1, criterionVersion: "c1" }]);
  });
});
