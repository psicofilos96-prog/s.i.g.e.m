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
import { annualMaxScore, compositionModelFromRule } from "./assessment-rule-model";
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
    expect(rule.periodicRecovery?.aggregation).toBeUndefined();
    expect(rule.finalRecovery?.maxScore).toBeUndefined();
    expect(rule.finalRecovery?.prevalence).toBeUndefined();
    expect(rule.rounding.applyAt).toEqual([]);
    expect(rule.categories.every((c) => c.minimumEntries === undefined)).toBe(true);
    expect(rule.categories.every((c) => c.instrumentTypePolicy === undefined)).toBe(true);
  });

  it("4. é reconhecida como rascunho incompleto", () => {
    const rule = anosFinais();
    expect(isRuleIncomplete(rule)).toBe(true);
    const codes = requiredPendingDefinitions(rule).map((p) => p.code);
    expect(codes).not.toContain("anual-consolidacao");
    expect(codes).toContain("recuperacao-periodica-formula");
    expect(codes).not.toContain("recuperacao-periodica-gatilho");
    expect(codes).toContain("recuperacao-final-teto");
    expect(codes).toContain("recuperacao-final-prevalencia");
    expect(codes).toContain("recuperacao-final-minimo-anual");
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
    const rule = { ...anosFinais() };
    delete (rule as { annualAggregation?: unknown }).annualAggregation;
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

  it("9. recuperação sem prevalência não é aplicada", () => {
    const base = anosFinais();
    const { prevalence: _p, ...periodic } = base.periodicRecovery!;
    const rule = { ...base, periodicRecovery: periodic };
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
    const base = anosFinais();
    const { prevalence: _p, ...periodic } = base.periodicRecovery!;
    const rule = { ...base, periodicRecovery: periodic };
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
    expect(text).toMatch(/soma dos tetos dos per[ií]odos/i);
    expect(text).toMatch(/consolida[çc][ãa]o est[áa] pendente/i);
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

  it("16. soma anual: total possível derivado dos tetos dos períodos", () => {
    const rule = anosFinais();
    expect(rule.annualAggregation).toEqual({ kind: "soma" });
    expect(annualMaxScore(rule, ["a", "b", "c"])).toBe(300);
    const custom = { ...rule, periodMaxScores: [{ calendarPeriodId: "c", maxScore: 200 }] };
    expect(annualMaxScore(custom, ["a", "b", "c"])).toBe(400);
    expect(annualMaxScore(rule, ["a", "b", "c", "d"])).toBe(400);
  });

  it("17. direito à recuperação periódica: resultado do período inferior a 50", () => {
    expect(anosFinais().periodicRecovery?.eligibility).toEqual({
      kind: "limite-de-pontuacao",
      threshold: 50,
      basis: "resultado-do-periodo",
    });
  });

  it("18. múltiplos instrumentos de recuperação sem regra não são combinados", () => {
    const rule = anosFinais();
    const model = compositionModelFromRule(rule);
    const recovery = { ...rule.periodicRecovery!, instrumentTypeIds: ["it-prova"] };
    const entry = (id: string, value: number) =>
      ({
        entryId: id,
        instrumentId: id,
        instrumentTypeId: "it-prova",
        periodId: "p1",
        configurationId: model.configurationId,
        value: { kind: "numerica", value },
        status: "registrado",
      }) as never;
    const two = applyRecovery({ recovery, model, point: "periodo", original: null, entries: [entry("r1", 40), entry("r2", 50)] });
    expect(two.applied).toBe(false);
    expect(two.reason).toMatch(/múltiplos instrumentos/i);
    const one = applyRecovery({ recovery, model, point: "periodo", original: null, entries: [entry("r1", 40)] });
    expect(one.applied).toBe(true);
  });

  it("19. recuperação final nasce com gatilho derivado e teto/prevalência pendentes", () => {
    const final = anosFinais().finalRecovery!;
    expect(final.scope).toBe("anual");
    expect(final.eligibility).toEqual({ kind: "abaixo-do-minimo-anual" });
    expect(final.maxScore).toBeUndefined();
    expect(final.prevalence).toBeUndefined();
  });

  it("20. arredondamento convencional confirmado, sem momento de aplicação", () => {
    const rounding = anosFinais().rounding;
    expect(rounding.decimals).toBe(0);
    expect(rounding.applyAt).toEqual([]);
  });
});
