import { describe, expect, it } from "vitest";
import { composeReplaceableSubtotal } from "./assessment-composition";
import { applyPeriodicRecovery } from "./assessment-recovery";
import { evaluateRecoveryEligibility } from "./assessment-recovery-evaluators";
import type { CompositionModel, PeriodComposition } from "./assessment-composition-types";
import type { RecoveryRule } from "./assessment-rule-types";

const model = {
  id: "m", configurationId: "cfg", configurationVersion: 2, scaleSemantics: "quantitativa",
  categories: [
    { id: "a", label: "A", instrumentTypeIds: ["ta"], weight: 1, minimumEntries: 1, aggregation: { kind: "media-simples" } },
    { id: "b", label: "B", instrumentTypeIds: ["tb"], weight: 3, minimumEntries: 1, aggregation: { kind: "media-simples" } },
    { id: "c", label: "C", instrumentTypeIds: ["tc"], weight: 1, minimumEntries: 1, aggregation: { kind: "media-simples" } },
  ],
  periodAggregation: { kind: "soma" }, cycleAggregation: { kind: "media-simples" }, requiresAllPeriods: true,
  rounding: { id: "arr-1", mode: "meio-acima", decimals: 0, applyAt: ["periodo"], normativeStatus: "homologado" },
  administrativeEntries: { accepted: false, acceptedOrigins: [], normativeStatus: "homologado" },
  normativeStatus: "homologado", version: 1,
} as unknown as CompositionModel;

const stage = (value: number) => ({ point: "categoria" as const, raw: value, value, rounded: false });
const cat = (categoryId: string, value: number, weight: number) =>
  ({ categoryId, label: categoryId, weight, usedEntryIds: [], usedEntries: [], origins: [], stage: stage(value), missing: [] });
const period = (): PeriodComposition => ({
  periodId: "p1", kind: "fechamento-do-periodo",
  categories: [cat("a", 10, 1), cat("b", 20, 3), cat("c", 30, 1)],
  stage: { point: "periodo", raw: 60, value: 60, rounded: false, roundingPolicyId: "arr-1" },
  complete: true, missing: [], unmatchedEntryIds: [], official: true,
});
const context = { ruleId: "rav", ruleVersion: 4, configurationId: "cfg", configurationVersion: 2, recoveryRuleId: "rec" };

const recovery = (over: Partial<RecoveryRule> = {}): RecoveryRule => ({
  id: "rec", enabled: true, scope: "periodo", replacesCategoryIds: ["a", "b"], instrumentTypeIds: ["tr"],
  prevalence: "maior-resultado", aggregation: { kind: "media-simples" }, normativeStatus: "homologado",
  eligibility: { kind: "limite-de-pontuacao", threshold: 25, basis: "subtotal-substituivel" },
  replaceableSubtotal: { aggregation: { kind: "soma" } },
  ...over,
});
const recEntry = { entryId: "r1", instrumentId: "ir", instrumentTypeId: "tr", periodId: "p1", configurationId: "cfg", configurationVersion: 2, value: { kind: "numerica", value: 40 }, status: "registrado", at: "2099-01-01" } as never;
const run = (r: RecoveryRule, withContext = true) => {
  const p = period();
  const snapshot = JSON.stringify(p);
  const out = applyPeriodicRecovery({ recovery: r, model, period: p, entries: [recEntry], ...(withContext ? { context } : {}) });
  expect(JSON.stringify(p)).toBe(snapshot); // M
  return out;
};

describe("6D.3.5.2b — subtotal substituível canônico", () => {
  it("A e O: replacesCategoryIds sozinho não produz subtotal; sem fallback para a agregação do período", () => {
    const f = composeReplaceableSubtotal({ model, period: period(), categoryIds: ["a", "b"], declaration: undefined, context });
    expect(f.status).toBe("indeterminate");
    const out = run(recovery({ replaceableSubtotal: undefined }));
    expect(out.applied).toBe(false);
    expect(out.eligibility?.eligible).toBe("indeterminate");
    expect(out.afterRecovery?.value).toBe(60);
  });

  it("B, C, D e N: produzido pelo motor com as categorias exatas; agregação muda o subtotal, não as categorias", () => {
    const p = period();
    const soma = composeReplaceableSubtotal({ model, period: p, categoryIds: ["a", "b"], declaration: { aggregation: { kind: "soma" } }, context });
    const pond = composeReplaceableSubtotal({ model, period: p, categoryIds: ["a", "b"], declaration: { aggregation: { kind: "media-ponderada" } }, context });
    if (soma.status !== "produced" || pond.status !== "produced") throw new Error("esperado produzido");
    expect(soma.receipt.value).toBe(30);
    expect(pond.receipt.value).toBe(17.5);
    expect(soma.receipt.categoryIds).toEqual(["a", "b"]);
    expect(soma.receipt.categoryResults).toEqual([
      { categoryId: "a", value: 10, weight: 1 },
      { categoryId: "b", value: 20, weight: 3 },
    ]);
    expect(soma.receipt).toMatchObject({ aggregation: { kind: "soma" }, raw: 30, rounded: false, context });
    expect(p.categories.map((c) => c.stage?.value)).toEqual([10, 20, 30]);
    const rounded = composeReplaceableSubtotal({ model, period: p, categoryIds: ["a", "b"], declaration: { aggregation: { kind: "media-ponderada" }, roundAt: "periodo" }, context });
    if (rounded.status !== "produced") throw new Error("esperado produzido");
    expect(rounded.receipt).toMatchObject({ raw: 17.5, value: 18, rounded: true, roundingPolicyId: "arr-1" });
  });

  it("E, F, G: declaração ausente, agregador desconhecido, parâmetro/fato ausente → indeterminado", () => {
    const base = { model, categoryIds: ["a", "b"], context };
    expect(composeReplaceableSubtotal({ ...base, period: period(), declaration: { aggregation: { kind: "formula" } as never } }).status).toBe("indeterminate");
    const noWeight = period();
    (noWeight.categories[1] as { weight: unknown }).weight = undefined;
    expect(composeReplaceableSubtotal({ ...base, period: noWeight, declaration: { aggregation: { kind: "media-ponderada" } } }).status).toBe("indeterminate");
    const missing = period();
    missing.categories[0]!.stage = null;
    expect(composeReplaceableSubtotal({ ...base, period: missing, declaration: { aggregation: { kind: "soma" } } }).status).toBe("indeterminate");
    expect(composeReplaceableSubtotal({ ...base, period: period(), declaration: { aggregation: { kind: "soma" } }, context: undefined }).status).toBe("indeterminate");
    expect(run(recovery(), false).applied).toBe(false);
  });

  it("H e I: o avaliador recebe só o valor pronto; abaixo/acima do limite", () => {
    const ref = { evaluatorId: "limite-de-pontuacao", parameters: { threshold: 25, basis: "subtotal-substituivel" } };
    expect(evaluateRecoveryEligibility(ref, { replaceableSubtotal: 24 }).eligible).toBe(true);
    expect(evaluateRecoveryEligibility(ref, { replaceableSubtotal: 25 }).eligible).toBe(false);
  });

  it("J: não elegível → recuperação não aplicada", () => {
    const out = run(recovery({ eligibility: { kind: "limite-de-pontuacao", threshold: 30, basis: "subtotal-substituivel" } }));
    expect(out.eligibility?.eligible).toBe(false);
    expect(out.applied).toBe(false);
    expect(out.recovery).toBeNull();
  });

  it("K: indeterminado → recuperação não aplicada", () => {
    const out = run(recovery({ eligibility: { kind: "limite-de-pontuacao", basis: "subtotal-substituivel" } }));
    expect(out.eligibility?.eligible).toBe("indeterminate");
    expect(out.applied).toBe(false);
  });

  it("L, M, N: elegível → motor existente aplica; original intacto; recibo completo", () => {
    const r = recovery({ eligibility: { kind: "limite-de-pontuacao", threshold: 31, basis: "subtotal-substituivel" } });
    const out = run(r);
    const core = applyPeriodicRecovery({ recovery: { ...r, eligibility: undefined }, model, period: period(), entries: [recEntry] });
    expect(out.eligibility?.eligible).toBe(true);
    expect(out.applied).toBe(core.applied);
    expect(out.afterRecovery?.value).toBe(core.afterRecovery?.value);
    expect(out.original?.value).toBe(60);
    expect(out.eligibility?.evaluatedFacts).toMatchObject({ threshold: 31, replaceableSubtotal: 30 });
    expect(out.replaceableSubtotal).toMatchObject({ status: "produced", receipt: { categoryIds: ["a", "b"], context } });
  });
});
