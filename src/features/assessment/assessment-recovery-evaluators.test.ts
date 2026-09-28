import { describe, expect, it } from "vitest";
import {
  evaluateRecoveryEffect,
  evaluateRecoveryEligibility,
  recoveryEligibilityRef,
} from "./assessment-recovery-evaluators";
import { applyRecovery, prevailValue } from "./assessment-recovery";
import { roundScore } from "./assessment-composition";
import type { CompositionModel, NumericStage } from "./assessment-composition-types";
import type { RecoveryRule } from "./assessment-rule-types";

const produced = (id: string, o: number | null, r: number) => {
  const res = evaluateRecoveryEffect({ evaluatorId: id }, o, r);
  if (res.status !== "produced") throw new Error("esperado produzido");
  return res.value;
};

// Referência congelada da implementação anterior (switch 12F).
function legacy(p: string, o: number | null, r: number) {
  if (o === null) return r;
  if (p === "maior-resultado") return Math.max(o, r);
  if (p === "menor-resultado") return Math.min(o, r);
  if (p === "media-entre-resultados") return Number(((o + r) / 2).toFixed(10));
  return r;
}

describe("6D.3.5.1 — prevalência por avaliador registrado", () => {
  it("A–D e N: maior, menor, mais recente, substituição e média são invariantes", () => {
    const ids = ["maior-resultado", "menor-resultado", "ultimo-resultado", "substituicao-direta", "media-entre-resultados"];
    const pairs: [number | null, number][] = [[40, 70], [80, 30], [55, 55], [null, 62], [33.3, 66.7], [0.1, 0.2]];
    for (const id of ids)
      for (const [o, r] of pairs) {
        expect(produced(id, o, r)).toBe(legacy(id, o, r));
        expect(prevailValue(id as never, o, r)).toBe(legacy(id, o, r));
      }
    expect(produced("media-entre-resultados", 40, 71)).toBe(55.5);
  });

  it("K: evaluatorId desconhecido falha fechada, sem 'maior resultado' presumido", () => {
    const res = evaluateRecoveryEffect({ evaluatorId: "formula-livre" }, 40, 90);
    expect(res.status).toBe("indeterminate");
    expect(evaluateRecoveryEffect(null, 40, 90).status).toBe("indeterminate");
  });

  const model = {
    rounding: { id: "arr-1", normativeStatus: "homologado" },
  } as unknown as CompositionModel;
  const rule = (over: Partial<RecoveryRule> = {}): RecoveryRule => ({
    id: "rec-1",
    enabled: true,
    scope: "periodo",
    replacesCategoryIds: [],
    instrumentTypeIds: ["rec"],
    prevalence: "maior-resultado",
    normativeStatus: "homologado",
    ...over,
  });
  const original: NumericStage = { point: "periodo", raw: 40, value: 40, rounded: false } as NumericStage;
  const entry = (value: number) => ({ entryId: "e-rec", instrumentTypeId: "rec", categoryId: "c", value: { kind: "numeric", value }, weight: 1 }) as never;

  it("E, F, M e proveniência: teto aplicado, arredondamento canônico, original intacto", () => {
    const out = applyRecovery({ recovery: rule({ maxScore: 60 }), model, point: "periodo", original, entries: [entry(90)] });
    expect(out.applied).toBe(true);
    expect(out.recovery!.value).toBe(roundScore(60, model.rounding, "periodo").value);
    expect(out.original).toBe(original);
    expect(original.value).toBe(40);
    expect(out.provenance).toMatchObject({ recoveryRuleId: "rec-1", effectEvaluatorId: "maior-resultado", originalValue: 40, cap: 60 });
  });

  it("K: regra com efeito desconhecido não aplica e preserva o original", () => {
    const out = applyRecovery({
      recovery: rule({ effect: { evaluatorId: "desconhecido" } }),
      model, point: "periodo", original, entries: [entry(90)],
    });
    expect(out.applied).toBe(false);
    expect(out.afterRecovery).toBe(original);
  });
});

describe("6D.3.5.1 — elegibilidade por avaliador registrado", () => {
  it("G: sem restrição → elegível", () => {
    expect(evaluateRecoveryEligibility({ evaluatorId: "sem-restricao" }, {}).eligible).toBe(true);
  });

  it("H: limite sobre resultado do período", () => {
    const ref = recoveryEligibilityRef({ kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-do-periodo" });
    expect(evaluateRecoveryEligibility(ref, { periodResult: 49 }).eligible).toBe(true);
    const at = evaluateRecoveryEligibility(ref, { periodResult: 50 });
    expect(at.eligible).toBe(false);
    expect(at.evaluatedFacts).toMatchObject({ threshold: 50, periodResult: 50 });
  });

  it("I: limite sobre subtotal substituível", () => {
    const ref = recoveryEligibilityRef({ kind: "limite-de-pontuacao", threshold: 30, basis: "subtotal-substituivel" });
    expect(evaluateRecoveryEligibility(ref, { replaceableSubtotal: 20, periodResult: 80 }).eligible).toBe(true);
    expect(evaluateRecoveryEligibility(ref, { replaceableSubtotal: 35, periodResult: 10 }).eligible).toBe(false);
  });

  it("J: mínimo anual preservado", () => {
    const ref = recoveryEligibilityRef({ kind: "abaixo-do-minimo-anual", minimumParameterId: "min" });
    const parameters = [{ id: "min", value: 60 }] as never;
    expect(evaluateRecoveryEligibility(ref, { cycleResult: 59, parameters }).eligible).toBe(true);
    expect(evaluateRecoveryEligibility(ref, { cycleResult: 60, parameters }).eligible).toBe(false);
    expect(evaluateRecoveryEligibility(ref, { cycleResult: 10 }).eligible).toBe("indeterminate");
  });

  it("K e L: avaliador desconhecido e fato ausente → indeterminado, nunca inferido", () => {
    expect(evaluateRecoveryEligibility({ evaluatorId: "x" }, { periodResult: 0 }).eligible).toBe("indeterminate");
    const ref = recoveryEligibilityRef({ kind: "limite-de-pontuacao", threshold: 50, basis: "subtotal-substituivel" });
    expect(evaluateRecoveryEligibility(ref, { periodResult: 10 }).eligible).toBe("indeterminate");
    expect(evaluateRecoveryEligibility(ref, { replaceableSubtotal: null }).eligible).toBe("indeterminate");
    expect(evaluateRecoveryEligibility(recoveryEligibilityRef({ kind: "limite-de-pontuacao", basis: "resultado-do-periodo" }), { periodResult: 1 }).eligible).toBe("indeterminate");
  });
});
