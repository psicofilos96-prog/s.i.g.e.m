import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validatePlanDraft, projectPlan, type PlanVersion } from "./individual-plan";

const draft = { objectives: ["Retomar frequência regular"], barrierRefs: ["B1"], actions: [{ key: "transporte", description: "Solicitar rota escolar", responsible: "secretaria", due: "2026-10-20" }],
  resources: ["passe"], pedagogicalInterventionRef: "I1", reason: null };
const v = (version: number, o: Partial<PlanVersion> = {}): PlanVersion => ({ caseId: "C", version, authorPerson: "p", ...draft, ...o });

describe("L12 plano individual", () => {
  it("valida ações, barreiras do caso, conteúdo e motivo de nova versão", () => {
    expect(validatePlanDraft(null, draft, new Set(["B1"]), "2026-10-01")).toBeNull();
    expect(validatePlanDraft(null, draft, new Set(), "2026-10-01")).toMatch(/Barreira/);
    expect(validatePlanDraft(null, { ...draft, actions: [...draft.actions, draft.actions[0]!] }, new Set(["B1"]), "2026-10-01")).toMatch(/repetida/);
    expect(validatePlanDraft(null, { ...draft, objectives: ["avaliar laudo"] }, new Set(["B1"]), "2026-10-01")).toMatch(/clínico/);
    expect(validatePlanDraft(v(1), draft, new Set(["B1"]), "2026-10-01")).toMatch(/motivo/);
  });
  it("resultados valem só para a versão vigente; reavaliação conclui", () => {
    const p = projectPlan([v(1), v(2, { reason: "ajuste após visita" })], [
      { caseId: "C", seq: 1, planVersion: 1, kind: "resultado-de-acao", actionKey: "transporte", outcome: "realizada", evidence: "rota concedida" },
      { caseId: "C", seq: 2, planVersion: 2, kind: "resultado-de-acao", actionKey: "transporte", outcome: "parcial", evidence: "rota parcial ok" },
    ], "2026-10-25")!;
    expect([p.actions[0]!.state, p.actions[0]!.overdue, p.needsReassessment, p.versions]).toEqual(["parcial", true, true, 2]);
    const q = projectPlan([v(1)], [{ caseId: "C", seq: 1, planVersion: 1, kind: "reavaliacao", actionKey: null, outcome: "concluir", evidence: "frequência retomada" }], "2026-10-25")!;
    expect(q.concluded).toBe(true);
    expect(() => projectPlan([v(2)], [], "2026-10-25")).toThrow();
  });
  it("banco referencia intervenção da Orientação sem copiá-la", () => {
    const sql = readFileSync("drizzle/migrations/0400_perm12_individual_plans.sql", "utf8");
    expect(sql).toMatch(/pedagogical_intervention_ref uuid/);
    expect(sql).toMatch(/permplan:intervention-mismatch/);
    expect(sql).not.toMatch(/CREATE TABLE public\.\w*intervention/);
  });
});
