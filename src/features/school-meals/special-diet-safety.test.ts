import { describe, it, expect } from "vitest";
import { planProblems, kitchenView, ingredientAlerts, clinicalAccess, evaluate, type DietPlan, type ChecklistVersion } from "./special-diet-safety";

const p: DietPlan = { id: "pl", studentId: "s1", restrictedItems: ["leite"], substitutions: [{ from: "leite", to: "bebida-soja" }],
  validFrom: "2026-02-01", validTo: null, reviewBy: "2026-02-28", authorId: "n", authorRegistry: "CRN-1", clinical: { condition: "APLV" } };

describe("alimentação especial", () => {
  it("plano só por nutricionista e substituto não restrito", () => {
    expect(planProblems({ ...p, authorRegistry: null })).toContain("plano alimentar só por nutricionista com registro profissional");
    expect(planProblems({ ...p, substitutions: [{ from: "leite", to: "leite" }] })).toContain("substituto leite também é restrito");
  });
  it("cozinha vê o mínimo, sem dado clínico; revisão vencida avisada", () => {
    const v = kitchenView([p], "2026-03-01", new Map([["s1", "Ana (3ºA)"]]));
    expect(JSON.stringify(v)).not.toContain("APLV");
    expect(v[0]!.review).toContain("vencida");
  });
  it("alerta de ingrediente com substituição autorizada", () => {
    expect(ingredientAlerts([p], "2026-03-01", { id: "mingau", items: ["leite", "aveia"] })[0]).toMatchObject({ item: "leite", substitute: "bebida-soja" });
  });
  it("detalhe clínico exige capability e finalidade e sempre audita", () => {
    expect(clinicalAccess(p, { userId: "c", hasCapability: false, purpose: "x" }, "t")).toMatchObject({ granted: false, event: { granted: false } });
    expect(clinicalAccess(p, { userId: "n", hasCapability: true, purpose: "revisão" }, "t").granted).toBe(true);
  });
});

describe("checklist sanitário", () => {
  const cl: ChecklistVersion = { id: "ck", version: 2, homologated: true, items: [
    { id: "t1", area: "temperatura", text: "Câmara fria", critical: true, numeric: { min: null, max: 5 } },
    { id: "h1", area: "higiene", text: "Mãos", critical: false }] };
  it("não conforme crítico gera encaminhamento; não responde vira pendência; sem laudo", () => {
    const r = evaluate(cl, [{ itemId: "t1", ok: null, value: 8, note: "" }], { id: "m", isPerson: true });
    if ("error" in r) throw new Error();
    expect(r.referrals.map((x) => x.itemId)).toEqual(["t1"]);
    expect(r.pending).toEqual(["h1"]);
    expect(evaluate(cl, [{ itemId: "h1", ok: true, value: null, note: "cozinha aprovada sanitariamente" }], { id: "m", isPerson: true })).toHaveProperty("error");
    expect(evaluate({ ...cl, homologated: false }, [], { id: "m", isPerson: true })).toHaveProperty("error");
  });
});
