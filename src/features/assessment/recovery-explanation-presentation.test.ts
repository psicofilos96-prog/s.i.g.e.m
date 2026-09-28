/** 6D.3.5.5 — explicabilidade da recuperação a partir do recibo, sem recálculo. */
import { describe, expect, it } from "vitest";
import type { ExplainedRecovery } from "./composition-explanation-projection";
import { presentRecoveryExplanation } from "./recovery-explanation-presentation";

const base = (over: Partial<ExplainedRecovery> = {}): ExplainedRecovery => ({
  state: "applied-with-effect",
  reason: "Substituição direta declarada pela regra.",
  originalValue: 160,
  recoveryValue: 95,
  finalValue: 95,
  entries: [
    { resolved: true, instrumentTitle: "Recuperação do 1º período", provenance: { entryVersionId: "ver-rec-1", version: 1 } } as never,
  ],
  eligibility: { kind: "unrestricted" },
  replaceableSubtotal: null,
  cap: null,
  provenance: {
    ruleId: "rav-x", ruleVersion: 3, recoveryRuleId: "rec-p", configurationId: "cfg-x", configurationVersion: 2,
    effectEvaluatorId: "substituicao-direta", replacedCategoryIds: [],
  },
  ...over,
});

describe("6D.3.5.5 — explicação da recuperação", () => {
  it("Nível 1: após e antes, vindos prontos do recibo; sem IDs técnicos", () => {
    const l = presentRecoveryExplanation(base())!;
    expect(l.level1).toEqual({ after: "95", before: "160" });
    const visible = [l.level1!.after, l.level1!.before, ...l.level2].join(" ");
    for (const id of ["rav-x", "rec-p", "cfg-x", "ver-rec-1", "substituicao-direta"]) expect(visible).not.toContain(id);
  });
  it("Nível 3: regra/versão, configuração/versão, efeito, subtotal, arredondamento e versão usada", () => {
    const l = presentRecoveryExplanation(
      base({
        replaceableSubtotal: { value: 40, rounded: true, aggregationKind: "media-ponderada", categoryResults: [{ categoryId: "cat-1", value: 40, weight: 2 }] },
        cap: 60,
        provenance: { ...base().provenance, roundingPolicyId: "arr-1", replacedCategoryIds: ["cat-1"] },
      }),
    )!;
    const t = l.level3.join(" | ");
    for (const s of ["rav-x v3", "cfg-x v2", "substituicao-direta", "media-ponderada, arredondado", "cat-1 = 40 (peso 2)", "arr-1", "versão 1 (ver-rec-1)"])
      expect(t).toContain(s);
    expect(l.level2.join(" ")).toContain("limite de 60");
  });
  it("considerada sem efeito, não elegível, elegível sem resultado e insuficiência são distintos", () => {
    expect(presentRecoveryExplanation(base({ state: "applied-without-effect", finalValue: 160 }))!.level1).toEqual({ after: "160", before: "160" });
    for (const state of ["not-eligible", "eligible-without-result", "normative-insufficiency", "eligibility-indeterminate"] as const) {
      const l = presentRecoveryExplanation(base({ state, recoveryValue: null, entries: [] }))!;
      expect(l.level1).toBeNull();
      expect(l.level2[0]).toBeTruthy();
    }
    expect(presentRecoveryExplanation(base({ state: "not-configured" }))).toBeNull();
  });
});
