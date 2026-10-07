import { describe, expect, it } from "vitest";
import { matrixIntegration, applicabilitySummary } from "./matrix-integration";
import type { InstitutionalMatrixItem } from "./curricular-matrix-source";

const item = (k: string, load: number | null): InstitutionalMatrixItem => ({
  versionId: "fx-v1", itemKey: k, position: 1,
  reference: { kind: "componente", componentId: `fx-${k}`, labelSnapshot: k },
  load: load === null ? null : { quantity: load, unitValueId: "fx-aula", unitValueVersion: 1 },
});
const app = [{ dimension: "ano-letivo" as const, academicYearId: "fx-ano" }, { dimension: "atributo" as const, schemeId: "fx-etapa", valueId: "fx-1", valueVersion: 1 }];
const by = (r: ReturnType<typeof matrixIntegration>, id: string) => r.find((x) => x.id === id)!;

describe("NCURR.2 integração da matriz", () => {
  it("homologada, aplicável e com carga ⇒ pronta para as quatro telas", () => {
    expect(matrixIntegration([item("lp", 5)], app, true).every((c) => c.state === "pronto")).toBe(true);
  });
  it("não homologada nunca fica pronta", () => {
    expect(matrixIntegration([item("lp", 5)], app, false).some((c) => c.state === "pronto")).toBe(false);
  });
  it("homologação não lida não vira homologada", () => {
    expect(by(matrixIntegration([item("lp", 5)], app, null), "diario").state).toBe("incompleto");
  });
  it("item sem carga ⇒ horários não calculáveis, nunca zero", () => {
    const h = by(matrixIntegration([item("lp", null)], app, true), "horarios");
    expect(h.state).toBe("incompleto");
    expect(h.reasons.join()).toMatch(/não calculáveis/);
    expect(by(matrixIntegration([item("lp", null)], app, true), "diario").state).toBe("pronto");
  });
  it("sem ano letivo ⇒ turmas não alcançadas", () => {
    expect(by(matrixIntegration([item("lp", 5)], [], true), "turmas").state).toBe("incompleto");
  });
  it("resumo conta esquemas sem inferir etapa ou turno", () => {
    expect(applicabilitySummary(app)).toEqual({ years: 1, schools: 0, schemes: ["fx-etapa"] });
  });
});
