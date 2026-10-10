import { describe, it, expect } from "vitest";
import { inspectorEligibility, schoolInspectionStatus, custodyCheck, sampleLabel, caeView, prepareForNutritionReview, type Candidate } from "./inspection-custody";
import { validateSaeb, pedagogicalSignal, feedbackAccess } from "@/features/educational-intelligence/saeb-risk";

const c = (o: Partial<Candidate>): Candidate => ({ personId: "p", schoolId: "e1", functionLabel: "Professor", engagementFrom: "2026-01-01", engagementUntil: null, termSignedAt: "2026-02-01", ...o });

describe("inspetores", () => {
  it("merendeiro não é elegível", () => { expect(inspectorEligibility(c({ functionLabel: "Merendeira" }), "2026-10-10").eligible).toBe(false); });
  it("sem função, vigência ou termo não é elegível", () => {
    expect(inspectorEligibility(c({ functionLabel: null }), "2026-10-10").eligible).toBe(false);
    expect(inspectorEligibility(c({ engagementUntil: "2026-05-01" }), "2026-10-10").eligible).toBe(false);
    expect(inspectorEligibility(c({ termSignedAt: null }), "2026-10-10").eligible).toBe(false);
  });
  it("escola exige no mínimo 2 válidos", () => {
    expect(schoolInspectionStatus("e1", [c({})], "2026-10-10").state).toBe("pendente");
    expect(schoolInspectionStatus("e1", [c({}), c({ personId: "q" })], "2026-10-10").state).toBe("completa");
  });
});

describe("amostras e custódia", () => {
  const ev = (kind: "coleta" | "lacre" | "guarda", at: string) => ({ kind, at, byPersonId: "p" });
  it("cadeia válida", () => { expect(custodyCheck({ id: "a", schoolId: "e", preparation: "Arroz", lot: "L1", servedOn: "2026-10-10", events: [ev("coleta", "1"), ev("lacre", "2"), ev("guarda", "3")] }).ok).toBe(true); });
  it("lote ausente e ordem invertida são apontados", () => {
    const r = custodyCheck({ id: "a", schoolId: "e", preparation: "x", lot: null, servedOn: null, events: [ev("lacre", "1"), ev("coleta", "2")] });
    expect(r.ok).toBe(false); expect(r.issues.length).toBeGreaterThanOrEqual(3);
  });
  it("etiqueta não inventa lote", () => { expect(sampleLabel({ id: "a", schoolId: "e", preparation: "x", lot: null, servedOn: null, events: [] })).toContain("Lote: não informado"); });
});

describe("CAE e revisão nutricional", () => {
  it("sem autorização nada; com autorização sem PII", () => {
    expect(caeView(false, [{ schoolId: "e" }]).rows).toEqual([]);
    const r = caeView(true, [{ schoolId: "e", studentName: "X", diagnosis: "Y", mealsServed: 10 }]);
    expect(Object.keys(r.rows[0]!)).not.toContain("studentName"); expect(Object.keys(r.rows[0]!)).not.toContain("diagnosis");
  });
  it("cardápio vai para revisão, nunca publicado", () => { expect(prepareForNutritionReview({ id: "m" }).published).toBe(false); });
});

describe("SAEB e risco", () => {
  const H = ["inep", "ano", "etapa", "componente", "proficiencia_media", "participacao"];
  it("leiaute incompleto recusado", () => { expect(validateSaeb(["inep"], []).ok).toBe(false); });
  it("INEP inválido recusado; vazio vira nulo", () => {
    expect(validateSaeb(H, [["123", "2023", "5", "LP", "200", "90"]]).ok).toBe(false);
    const r = validateSaeb(H, [["33097461", "2023", "5", "LP", "", "90"]]); expect(r.ok && r.rows[0]!.proficiency).toBe(null);
  });
  it("risco sem parâmetro homologado é não oficial e ausência não sinaliza", () => {
    const r = pedagogicalSignal({ state: "pendente", ref: null, attendanceBelow: 75, gradeBelow: null }, { attendanceRate: 60, gradeAverage: null });
    expect(r.official).toBe(false); expect(r.signals).toEqual(["frequência abaixo do parâmetro"]);
    expect(pedagogicalSignal({ state: "pendente", ref: null, attendanceBelow: 75, gradeBelow: 5 }, { attendanceRate: null, gradeAverage: null }).signals).toEqual([]);
  });
  it("leitura e escrita de devolutivas separadas", () => { expect(feedbackAccess(new Set(["consultar-devolutivas"]))).toEqual({ read: true, write: false }); });
});
