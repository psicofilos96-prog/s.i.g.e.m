/**
 * Etapa 12F.1 — rascunho institucional INCOMPLETO.
 *
 * Verifica que ausência de definição normativa permanece ausência: não vira
 * configuração provisória, bloqueia revisão/homologação e bloqueia cálculo
 * anual, sem restringir a capacidade do domínio.
 */
import { describe, expect, it } from "vitest";

import { consolidateAnnual } from "./assessment-composition";
import { applyPeriodicRecovery, applyRecovery } from "./assessment-recovery";
import { createAssessmentRuleFixtures } from "./assessment-rule-fixtures";
import { createRule, mutateRule, transitionRule } from "./assessment-rule-governance";
import { compositionModelFromRule } from "./assessment-rule-model";
import {
  isRuleIncomplete,
  pendingRuleDefinitions,
  requiredPendingDefinitions,
} from "./assessment-rule-pending";
import { describeRule } from "./assessment-rule-preview";
import {
  RECOVERY_PREVALENCE_LABEL,
  SUPERVISION_RECOVERY_PREVALENCES,
  type InstitutionalAssessmentRule,
} from "./assessment-rule-types";
import { validateRule } from "./assessment-rule-validation";
import { assessmentConfigurations, instrumentTypes } from "./assessment-fixtures";
import { calendarRepository } from "../calendar/calendar-store";

const supervisao = {
  id: "act-supervisao",
  name: "Supervisão de Ensino",
  role: "supervisao" as const,
};

const anosFinais = () => {
  const rule = createAssessmentRuleFixtures().find((r) => r.id === "rav-ef-anos-finais");
  expect(rule).toBeDefined();
  return rule as InstitutionalAssessmentRule;
};

const ctx = (rule: InstitutionalAssessmentRule) => ({
  calendar: calendarRepository.get(rule.scope.calendarId),
  instrumentTypeIds: instrumentTypes.map((t) => t.id),
});

describe("12F.1 — regra real em elaboração (Anos Finais)", () => {
  it("1. nasce em rascunho, nunca homologada", () => {
    expect(anosFinais().status).toBe("rascunho");
  });

  it("2. cadastra apenas os limites confirmados pela rede", () => {
    const rule = anosFinais();
    expect(rule.categories.map((c) => [c.id, c.maxScore])).toEqual([
      ["cat-av1", 30],
      ["cat-av2", 30],
      ["cat-iv", 35],
      ["cat-part", 5],
    ]);
    expect(rule.periodMaxScore).toBe(100);
    expect(rule.periodicRecovery?.maxScore).toBe(60);
    expect(rule.periodicRecovery?.replacesCategoryIds).toEqual(["cat-av1", "cat-av2"]);
    expect(rule.periodicRecovery?.prevalence).toBe("maior-resultado");
  });

  it("3. o que não foi decidido permanece ausente", () => {
    const rule = anosFinais();
    expect(rule.annualAggregation).toBeUndefined();
    expect(rule.finalRecovery).toBeUndefined();
    expect(rule.periodicRecovery?.aggregation).toBeUndefined();
    expect(rule.periodicRecovery?.eligibility).toBeUndefined();
    expect(rule.rounding.applyAt).toEqual([]);
    expect(rule.categories.every((c) => c.minimumEntries === undefined)).toBe(true);
    expect(rule.categories.every((c) => c.instrumentTypePolicy === undefined)).toBe(true);
  });

  it("4. é reconhecida como rascunho incompleto", () => {
    const rule = anosFinais();
    expect(isRuleIncomplete(rule)).toBe(true);
    const codes = requiredPendingDefinitions(rule).map((p) => p.code);
    expect(codes).toContain("anual-consolidacao");
    expect(codes).toContain("recuperacao-periodica-formula");
    expect(codes).toContain("recuperacao-periodica-gatilho");
    expect(codes).toContain("arredondamento-momento");
  });

  it("5. pendências opcionais não bloqueiam", () => {
    const optional = pendingRuleDefinitions(anosFinais()).filter((p) => !p.required);
    expect(optional.some((p) => p.code.startsWith("categoria-minimo-"))).toBe(true);
    expect(optional.every((p) => p.required === false)).toBe(true);
  });

  it("6. validação recusa revisão e homologação enquanto houver pendência obrigatória", () => {
    const rule = anosFinais();
    const validation = validateRule(rule, ctx(rule));
    expect(validation.requiredPending.length).toBeGreaterThan(0);
    expect(validation.ok).toBe(false);

    const review = transitionRule(rule, supervisao, "enviar-revisao", {
      blockingErrors: validation.errors.length,
      requiredPending: validation.requiredPending.length,
    });
    expect(review.ok).toBe(false);
    expect(review.ok === false && review.reason).toMatch(/pendentes/i);
  });

  it("7. homologação também é recusada com pendências obrigatórias", () => {
    const rule = { ...anosFinais(), status: "em-revisao" as const };
    const result = transitionRule(rule, supervisao, "homologar", { requiredPending: 2 });
    expect(result.ok).toBe(false);
  });

  it("8. consolidação anual pendente bloqueia o cálculo anual", () => {
    const rule = anosFinais();
    const model = compositionModelFromRule(rule);
    expect(model.annualAggregation).toBeUndefined();
    const configuration = assessmentConfigurations.find((c) => c.allowsGrades)!;
    const annual = consolidateAnnual({
      configuration,
      model: { ...model, configurationId: configuration.id },
      periods: [],
      entries: [],
    });
    expect(annual.kind).toBe("bloqueado");
    expect(annual.official).toBe(false);
    expect(annual.final).toBe(false);
  });

  it("9. recuperação sem fórmula não é aplicada", () => {
    const rule = anosFinais();
    const model = compositionModelFromRule(rule);
    const outcome = applyRecovery({
      recovery: rule.periodicRecovery,
      model,
      point: "periodo",
      original: null,
      entries: [],
    });
    expect(outcome.applied).toBe(false);
    expect(outcome.reason).toMatch(/pendente/i);
  });

  it("10. recuperação periódica por categoria também respeita a pendência", () => {
    const rule = anosFinais();
    const model = compositionModelFromRule(rule);
    const outcome = applyPeriodicRecovery({
      recovery: rule.periodicRecovery,
      model,
      period: {
        kind: "acumulado-parcial",
        periodId: "p1",
        categories: [],
        stage: null,
        missing: [],
        complete: false,
        official: false,
      },
      entries: [],
    });
    expect(outcome.applied).toBe(false);
  });

  it("11. a prévia declara as pendências em vez de presumir fórmulas", () => {
    const rule = anosFinais();
    const text = describeRule(rule, {
      calendar: calendarRepository.get(rule.scope.calendarId),
      instrumentTypes,
      yearLabel: "2027",
      stageLabels: ["Anos Finais"],
    })
      .flatMap((s) => s.lines)
      .join(" ");
    expect(text).toMatch(/consolida[çc][ãa]o anual pendente/i);
    expect(text).toMatch(/preval[êe]ncia|maior resultado/i);
  });

  it("12. novo rascunho não presume consolidação anual", () => {
    const created = createRule(supervisao, {
      name: "Rascunho novo",
      academicYearId: "ano-2027",
      calendarId: "cal-rede-2027-regular",
    });
    expect(created.ok && created.rule.annualAggregation).toBeUndefined();
    expect(created.ok && isRuleIncomplete(created.rule)).toBe(true);
  });

  it("13. limpar uma definição a devolve ao estado pendente", () => {
    const rule = anosFinais();
    const withAnnual = mutateRule(rule, supervisao, {
      kind: "consolidacao-anual",
      patch: { annualAggregation: { kind: "soma" } },
    });
    expect(withAnnual.ok && withAnnual.rule.annualAggregation?.kind).toBe("soma");
    const cleared =
      withAnnual.ok &&
      mutateRule(withAnnual.rule, supervisao, {
        kind: "consolidacao-anual",
        patch: { annualAggregation: null },
      });
    expect(cleared && cleared.ok && cleared.rule.annualAggregation).toBeUndefined();
  });

  it("14. a interface da Supervisão expõe só prevalências com propósito pedagógico", () => {
    expect(SUPERVISION_RECOVERY_PREVALENCES).toEqual(["maior-resultado", "substituicao-direta"]);
    // O domínio permanece CAPAZ de representar as demais formas.
    expect(Object.keys(RECOVERY_PREVALENCE_LABEL).length).toBeGreaterThan(
      SUPERVISION_RECOVERY_PREVALENCES.length,
    );
  });

  it("15. tipos de instrumento em aberto não são erro de validação", () => {
    const rule = anosFinais();
    const validation = validateRule(rule, ctx(rule));
    expect(validation.errors.some((e) => e.code === "categoria-sem-instrumento")).toBe(false);
    expect(validation.warnings.some((w) => w.code === "recuperacao-sem-instrumento")).toBe(true);
  });
});
