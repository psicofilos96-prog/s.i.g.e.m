import { describe, it, expect } from "vitest";
import { myHistory, canShare, canReceive, CONTRACTS } from "./mediator-history-integration";

const des = [
  { logicalId: "D1", schoolId: "sA", schoolName: "E.M. A", studentId: "e1", studentName: "ana maria souza", from: "2025-02-01", to: "2025-12-15", functionId: "f" },
  { logicalId: "D2", schoolId: "sB", schoolName: "E.M. B", studentId: "e2", studentName: "Bruno Lima", from: "2026-02-01", to: null, functionId: "f" },
];
const authored = [{ id: "r1", kind: "registro" as const, date: "2025-03-01", designationId: "D1" }, { id: "r2", kind: "relatorio" as const, date: "2025-06-01", designationId: "D1" }];

describe("Mediador L16 — histórico e integração", () => {
  it("histórico com designações, escolas e contagens; ex-aluno só por iniciais e sem abrir ficha", () => {
    const h = myHistory({ today: "2026-03-10", designations: des, authored, trainings: [] });
    expect(h.schools).toEqual(["E.M. A", "E.M. B"]);
    expect(h.designations[0]).toMatchObject({ designationId: "D2", student: "Bruno Lima", canOpenStudent: true });
    expect(h.designations[1]).toMatchObject({ student: "A. M. S.", canOpenStudent: false, records: 2, reports: 1 });
  });
  it("fontes não lidas viram limitações, nunca zero silencioso", () => {
    expect(myHistory({ today: "2026-03-10", designations: null, authored: null, trainings: null }).limitations).toHaveLength(3);
  });
  it("contratos: cada setor só recebe o declarado", () => {
    expect(CONTRACTS.map((c) => c.sector).sort()).toEqual(["aa", "direcao", "docente", "familia", "nei", "orientacao", "secretaria", "supervisao"]);
    expect(canShare("docente", "observacao", { hasCapability: () => false }).ok).toBe(true);
    expect(canShare("secretaria", "observacao", { hasCapability: () => true }).ok).toBe(false);
    expect(canShare("aa", "registro-diario", { hasCapability: () => true }).ok).toBe(false);
    expect(canShare("supervisao", "relatorio", { hasCapability: () => false }).ok).toBe(false);
    expect(canReceive("direcao", "designacao")).toBe(true);
  });
  it("família só por canal institucional com autorização vigente", () => {
    expect(canShare("familia", "comunicado-institucional", { hasCapability: () => true, familyAuthorizationActive: true }).ok).toBe(false);
    expect(canShare("familia", "comunicado-institucional", { hasCapability: () => true, viaInstitutionalChannel: true }).ok).toBe(false);
    expect(canShare("familia", "comunicado-institucional", { hasCapability: () => true, viaInstitutionalChannel: true, familyAuthorizationActive: true }).ok).toBe(true);
    expect(canShare("familia", "registro-diario", { hasCapability: () => true, viaInstitutionalChannel: true, familyAuthorizationActive: true }).ok).toBe(false);
  });
});
