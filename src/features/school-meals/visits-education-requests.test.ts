import { describe, it, expect } from "vitest";
import { scheduleVisit, saveReport, advanceVisit, addEvidence, verifyGuidance, overdueGuidance, eduProblems, eduProgress, openMealRequest, type MealVisit } from "./visits-education-requests";
import { advanceDemand } from "@/features/school-management/demand-center";

const inst = { id: "inst", version: 3, homologated: true, items: [{ key: "higiene", label: "Higiene" }] };
const base = { id: "v1", schoolId: "E1", nutritionistId: "n", nutritionistRegistry: "CRN-1", plannedOn: "2026-03-10" };

describe("visitas técnicas", () => {
  it("só nutricionista com instrumento homologado congelado; sem duplicar", () => {
    expect(scheduleVisit({ ...base, nutritionistRegistry: null }, inst, [])).toHaveProperty("error");
    expect(scheduleVisit(base, { ...inst, homologated: false }, [])).toHaveProperty("error");
    const v = scheduleVisit(base, inst, []) as MealVisit;
    expect(v.instrument).toBe("inst@v3");
    expect(scheduleVisit(base, inst, [v])).toEqual({ error: "visita já agendada" });
  });
  it("evidência privada, relatório versionado e conclusão por revisor distinto", () => {
    let v = scheduleVisit(base, inst, []) as MealVisit;
    expect((addEvidence(v, "foto1.jpg") as MealVisit).evidence[0]).toBe("alimentacao-evidencias/visitas/E1/v1/foto1.jpg");
    expect(addEvidence(v, "../x")).toHaveProperty("error");
    v = advanceVisit(v, "realizada", { id: "n", isPerson: true, registry: "CRN-1" }) as MealVisit;
    expect(advanceVisit(v, "relatorio-em-revisao", { id: "n", isPerson: true, registry: "CRN-1" })).toHaveProperty("error");
    v = { ...(saveReport(v, "ok", "n", 0, null) as MealVisit), answers: { higiene: "conforme" } };
    expect(saveReport(v, "ok2", "n", 1, null)).toEqual({ error: "nova versão exige motivo" });
    v = advanceVisit(v, "relatorio-em-revisao", { id: "n", isPerson: true, registry: "CRN-1" }) as MealVisit;
    expect(advanceVisit(v, "concluida", { id: "n", isPerson: true, registry: "CRN-1" })).toHaveProperty("error");
    expect((advanceVisit(v, "concluida", { id: "r", isPerson: true, registry: "CRN-2" }) as MealVisit).state).toBe("concluida");
  });
  it("orientação verificada só com evidência; vencidas listadas", () => {
    const g = { id: "g", text: "t", responsible: "d", due: "2026-03-01", verifiedAt: null, verifiedBy: null };
    expect(verifyGuidance(g, "n", "x", null)).toHaveProperty("error");
    expect(overdueGuidance({ ...(scheduleVisit(base, inst, []) as MealVisit), guidance: [g] }, "2026-03-05")).toHaveLength(1);
  });
});

describe("educação alimentar e solicitações", () => {
  it("projeto exige docente com atuação vigente; progresso não presume", () => {
    const p = { id: "p", schoolId: "E1", title: "Horta", classIds: ["t"], partners: [{ kind: "op" as const, engagementId: "e1" }], sessions: [{ on: "x", done: true }, { on: "y", done: null }], planRef: null };
    expect(eduProblems(p, new Set(["e1"]))).toContain("projeto exige docente parceiro (autoria pedagógica é dele)");
    expect(eduProgress(p)).toEqual({ planned: 2, done: 1, notInformed: 1 });
  });
  it("solicitação usa a central única com fluxo e concorrência", () => {
    const r = openMealRequest({ id: "d1", schoolId: "E1", kind: "equipamento", urgent: false, urgencyReason: null, description: "fogão" }, "dir", true, "2026-03-01");
    if (!r.ok) throw new Error(r.code);
    expect(r.demand.area).toBe("alimentacao");
    expect(openMealRequest({ id: "d2", schoolId: "E1", kind: "equipamento", urgent: false, urgencyReason: null, description: "x" }, "bot", false, "x").ok).toBe(false);
    const n = advanceDemand(r.demand, { step: "triagem", by: "nae", isNaturalPerson: true, on: "2026-03-02" }, 1, { schoolId: null, semedArea: "alimentacao" });
    expect(n.ok).toBe(true);
  });
});
