import { describe, it, expect } from "vitest";
import { mediatorPlanView, validateMediatorAct, canWritePlanVersion, type PlanVersion } from "./mediator-support-plan";

const base = (version: number, status: PlanVersion["status"], over: Partial<PlanVersion> = {}): PlanVersion => ({
  planId: "P1", kind: "PEI", version, status, studentId: "e1", schoolId: "sA", validFrom: "2026-02-01", validTo: null, reason: "r", authorPersonId: "nei1",
  items: [
    { id: "o1", section: "objetivo", text: "Ampliar autonomia na rotina", forMediation: true, responsibleLabel: "AEE", until: null },
    { id: "c1", section: "clinico", text: "Laudo CID F84", forMediation: true, responsibleLabel: null, until: null },
    { id: "e1", section: "estrategia", text: "Antecipar mudanças", forMediation: false, responsibleLabel: null, until: null },
    { id: "r1", section: "recurso", text: "Conforme laudo neurológico", forMediation: true, responsibleLabel: null, until: null },
  ],
  decisions: [{ by: "nei1", role: "Coordenação NEI", at: "2026-02-01", text: "Decisão detalhada" }], ...over,
});
const ctx = { personId: "m1", studentIds: ["e1"], date: "2026-03-01" };

describe("Mediador L06 — Plano Integrado (leitura operacional do plano NEI)", () => {
  it("só versão concluída vigente; rascunho mais novo não aparece", () => {
    const v = mediatorPlanView([base(1, "concluido"), base(2, "rascunho")], "P1", ctx);
    expect(v.state === "ok" && v.version).toBe(1);
  });
  it("só seções operacionais marcadas; clínico nunca; texto clínico retido; decisão sem texto", () => {
    const v = mediatorPlanView([base(1, "concluido")], "P1", ctx);
    if (v.state !== "ok") throw new Error();
    expect(v.items.map((i) => i.id)).toEqual(["o1", "r1"]);
    expect(v.items[1]).toMatchObject({ text: null, withheld: true });
    expect(JSON.stringify(v)).not.toMatch(/laudo|CID|Decisão detalhada/i);
  });
  it("sem designação ou sem fonte ⇒ nada", () => {
    expect(mediatorPlanView([base(1, "concluido")], "P1", { ...ctx, studentIds: [] }).state).toBe("sem-designacao");
    expect(mediatorPlanView(null, "P1", ctx).state).toBe("nao-disponivel");
  });
  it("mediador nunca grava versão; observação/pedido não alteram o plano e são idempotentes", () => {
    expect(canWritePlanVersion(ctx)).toBe(false);
    const a = { kind: "pedido-revisao" as const, planId: "P1", version: 1, itemId: "o1", text: "Estratégia não funciona no recreio" };
    const r = validateMediatorAct(a, [base(1, "concluido")], ctx, []);
    expect(r.ok && r.event.effectOnPlan).toBe("nenhum");
    if (!r.ok) throw new Error();
    expect(validateMediatorAct(a, [base(1, "concluido")], ctx, [{ key: r.event.idempotencyKey }]).ok).toBe(false);
  });
  it("versão desatualizada, item oculto e texto clínico recusados", () => {
    const vs = [base(1, "concluido"), base(2, "concluido")];
    const r = validateMediatorAct({ kind: "observacao", planId: "P1", version: 1, itemId: "e1", text: "suspeita de transtorno" }, vs, ctx, []);
    expect(r.ok ? [] : r.reasons).toHaveLength(3);
  });
});
