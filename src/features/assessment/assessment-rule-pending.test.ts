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
    const two = applyRecovery({
      recovery,
      model,
      point: "periodo",
      original: null,
      entries: [entry("r1", 40), entry("r2", 50)],
    });
    expect(two.applied).toBe(false);
    expect(two.reason).toMatch(/múltiplos instrumentos/i);
    const one = applyRecovery({
      recovery,
      model,
      point: "periodo",
      original: null,
      entries: [entry("r1", 40)],
    });
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

const anosIniciais = () => {
  const rule = createAssessmentRuleFixtures().find((r) => r.id === "rav-ef-anos-iniciais");
  expect(rule).toBeDefined();
  return rule as InstitutionalAssessmentRule;
};

describe("12F.3 — regra real em elaboração (Anos Iniciais)", () => {
  it("1. nasce em rascunho, nunca homologada", () => {
    expect(anosIniciais().status).toBe("rascunho");
  });

  it("2. cadastra a composição confirmada, como configuração variável", () => {
    const rule = anosIniciais();
    expect(rule.categories.map((c) => [c.id, c.maxScore])).toEqual([
      ["cat-av1", 30],
      ["cat-av2", 30],
      ["cat-iv", 35],
      ["cat-part", 5],
    ]);
    expect(rule.periodMaxScore).toBe(100);
    expect(rule.scales[0]).toMatchObject({ kind: "numerica", min: 0, max: 100 });
  });

  it("3. não possui recuperação periódica: somente recuperação final", () => {
    const rule = anosIniciais();
    expect(rule.periodicRecovery).toBeUndefined();
    expect(pendingRuleDefinitions(rule).filter((p) => p.area === "recuperacao-periodica")).toEqual(
      [],
    );
  });

  it("4. consolidação anual confirmada: média dos períodos, sem quantidade fixa", () => {
    const rule = anosIniciais();
    expect(rule.annualAggregation).toEqual({ kind: "media-simples" });
    expect(rule.requiresAllPeriods).toBe(true);
    // Nenhuma quantidade de períodos é fixada: vem do calendário.
    expect(rule.scope.calendarId).toBe("cal-rede-2027-regular");
  });

  it("5. recuperação final: direito abaixo de 50 no resultado anual, teto 100, maior resultado", () => {
    const final = anosIniciais().finalRecovery!;
    expect(final.enabled).toBe(true);
    expect(final.scope).toBe("anual");
    expect(final.eligibility).toEqual({
      kind: "limite-de-pontuacao",
      threshold: 50,
      basis: "resultado-anual",
    });
    expect(final.maxScore).toBe(100);
    expect(final.prevalence).toBe("maior-resultado");
  });

  it("6. consolidação entre múltiplos registros da recuperação final permanece pendente", () => {
    const rule = anosIniciais();
    expect(rule.finalRecovery!.aggregation).toBeUndefined();
    const codes = requiredPendingDefinitions(rule).map((p) => p.code);
    expect(codes).toContain("recuperacao-final-formula");
  });

  it("7. tipos de instrumento por categoria e quantidades mínimas permanecem pendentes", () => {
    const rule = anosIniciais();
    const optionais = pendingRuleDefinitions(rule).filter((p) => !p.required);
    expect(optionais.some((p) => p.code === "categoria-tipos-cat-av1")).toBe(true);
    expect(optionais.some((p) => p.code === "categoria-minimo-cat-av1")).toBe(true);
    // Não bloqueiam, mas nada é presumido.
    for (const category of rule.categories) {
      expect(category.instrumentTypePolicy).toBeUndefined();
      expect(category.minimumEntries).toBeUndefined();
    }
  });

  it("8. arredondamento convencional confirmado no período e no anual", () => {
    const rounding = anosIniciais().rounding;
    expect(rounding.mode).toBe("meio-acima");
    expect(rounding.decimals).toBe(0);
    expect(rounding.applyAt).toEqual(["periodo", "anual"]);
    expect(
      requiredPendingDefinitions(anosIniciais()).some((p) => p.area === "arredondamento"),
    ).toBe(false);
  });

  it("9. transferências externas entram na composição como valor administrativo", () => {
    const entries = anosIniciais().administrativeEntries;
    expect(entries.accepted).toBe(true);
    expect(entries.acceptedOrigins).toContain("transferencia-externa");
  });

  it("10. vigência confirmada a partir de 2027", () => {
    const rule = anosIniciais();
    expect(rule.validFrom).toBe("2027-01-01");
    expect(requiredPendingDefinitions(rule).some((p) => p.area === "vigencia")).toBe(false);
  });

  it("11. rascunho incompleto: revisão e homologação recusadas", () => {
    const rule = anosIniciais();
    expect(isRuleIncomplete(rule)).toBe(true);
    const pending = requiredPendingDefinitions(rule).length;
    const review = transitionRule(rule, supervisao, "enviar-revisao", {
      requiredPending: pending,
    });
    expect(review.ok).toBe(false);
    if (!review.ok) expect(review.reason).toMatch(/pendente/);
    const homologation = transitionRule(rule, supervisao, "homologar", {
      requiredPending: pending,
    });
    expect(homologation.ok).toBe(false);
  });

  it("12. nenhuma regra real sai homologada das fixtures", () => {
    const rules = createAssessmentRuleFixtures();
    expect(rules.filter((r) => r.status === "homologada")).toEqual([]);
  });
});

const ejaFases15 = () => {
  const rule = createAssessmentRuleFixtures().find((r) => r.id === "rav-eja-fases-1-5");
  expect(rule).toBeDefined();
  return rule as InstitutionalAssessmentRule;
};

describe("12F.3 — regra real em elaboração (EJA Fases 1–5)", () => {
  it("1. nasce em rascunho, no calendário EJA, nunca homologada", () => {
    const rule = ejaFases15();
    expect(rule.status).toBe("rascunho");
    expect(rule.scope.calendarId).toBe("cal-rede-2027-eja");
    expect(rule.scope.stageIds).toEqual(["etp-demo-eja-fases-1-5"]);
  });

  it("2. estratégia quantitativa por disciplina, escala 0–100", () => {
    const rule = ejaFases15();
    expect(rule.strategy).toBe("quantitativa");
    expect(rule.allowsGrades).toBe(true);
    expect(rule.scales[0]).toMatchObject({ kind: "numerica", min: 0, max: 100 });
  });

  it("3. composição confirmada como configuração variável, nunca fixa", () => {
    const rule = ejaFases15();
    expect(rule.categories.map((c) => [c.id, c.maxScore])).toEqual([
      ["cat-av1", 30],
      ["cat-av2", 30],
      ["cat-iv", 35],
      ["cat-part", 5],
    ]);
    expect(rule.periodMaxScore).toBe(100);
  });

  it("4. recuperação periódica não definida: nenhuma estrutura é presumida", () => {
    const rule = ejaFases15();
    expect(rule.periodicRecovery).toBeUndefined();
  });

  it("5. consolidação anual confirmada: média dos períodos, sem quantidade fixa", () => {
    const rule = ejaFases15();
    expect(rule.annualAggregation).toEqual({ kind: "media-simples" });
    expect(rule.requiresAllPeriods).toBe(true);
  });

  it("6. recuperação final: direito abaixo de 50 no resultado anual, teto 100, maior resultado", () => {
    const final = ejaFases15().finalRecovery!;
    expect(final.enabled).toBe(true);
    expect(final.scope).toBe("anual");
    expect(final.eligibility).toEqual({
      kind: "limite-de-pontuacao",
      threshold: 50,
      basis: "resultado-anual",
    });
    expect(final.maxScore).toBe(100);
    expect(final.prevalence).toBe("maior-resultado");
  });

  it("7. consolidação entre múltiplos registros da recuperação final permanece pendente", () => {
    const rule = ejaFases15();
    expect(rule.finalRecovery!.aggregation).toBeUndefined();
    const codes = requiredPendingDefinitions(rule).map((p) => p.code);
    expect(codes).toContain("recuperacao-final-formula");
  });

  it("8. arredondamento convencional confirmado no período e no anual", () => {
    const rounding = ejaFases15().rounding;
    expect(rounding.mode).toBe("meio-acima");
    expect(rounding.decimals).toBe(0);
    expect(rounding.applyAt).toEqual(["periodo", "anual"]);
  });

  it("9. transferências externas entram na composição como valor administrativo", () => {
    const entries = ejaFases15().administrativeEntries;
    expect(entries.accepted).toBe(true);
    expect(entries.acceptedOrigins).toContain("transferencia-externa");
  });

  it("10. vigência não confirmada: permanece pendência obrigatória", () => {
    const rule = ejaFases15();
    expect(rule.validFrom).toBeUndefined();
    expect(requiredPendingDefinitions(rule).some((p) => p.code === "vigencia-inicio")).toBe(true);
  });

  it("11. rascunho incompleto: revisão e homologação recusadas", () => {
    const rule = ejaFases15();
    expect(isRuleIncomplete(rule)).toBe(true);
    const pending = requiredPendingDefinitions(rule).length;
    const review = transitionRule(rule, supervisao, "enviar-revisao", {
      requiredPending: pending,
    });
    expect(review.ok).toBe(false);
    const homologation = transitionRule(rule, supervisao, "homologar", {
      requiredPending: pending,
    });
    expect(homologation.ok).toBe(false);
  });
});

const ejaFases69 = () => {
  const rule = createAssessmentRuleFixtures().find((r) => r.id === "rav-eja-fases-6-9");
  expect(rule).toBeDefined();
  return rule as InstitutionalAssessmentRule;
};

describe("12F.3 — regra real em elaboração (EJA Fases 6–9)", () => {
  it("1. nasce em rascunho, no calendário EJA, nunca homologada", () => {
    const rule = ejaFases69();
    expect(rule.status).toBe("rascunho");
    expect(rule.scope.calendarId).toBe("cal-rede-2027-eja");
    expect(rule.scope.stageIds).toEqual(["etp-demo-eja-fases-6-9"]);
  });

  it("2. estratégia quantitativa por disciplina, escala 0–100", () => {
    const rule = ejaFases69();
    expect(rule.strategy).toBe("quantitativa");
    expect(rule.allowsGrades).toBe(true);
    expect(rule.scales[0]).toMatchObject({ kind: "numerica", min: 0, max: 100 });
  });

  it("3. composição confirmada como configuração variável, nunca fixa", () => {
    const rule = ejaFases69();
    expect(rule.categories.map((c) => [c.id, c.maxScore])).toEqual([
      ["cat-av1", 30],
      ["cat-av2", 30],
      ["cat-iv", 35],
      ["cat-part", 5],
    ]);
    expect(rule.periodMaxScore).toBe(100);
  });

  it("4. recuperação periódica não definida: nenhuma estrutura é presumida", () => {
    const rule = ejaFases69();
    expect(rule.periodicRecovery).toBeUndefined();
  });

  it("5. fechamento da fase: média dos períodos, sem quantidade fixa (EJA semestral)", () => {
    const rule = ejaFases69();
    expect(rule.annualAggregation).toEqual({ kind: "media-simples" });
    expect(rule.requiresAllPeriods).toBe(true);
  });

  it("6. recuperação final: direito abaixo de 50 no resultado da fase, teto 100, maior resultado", () => {
    const final = ejaFases69().finalRecovery!;
    expect(final.enabled).toBe(true);
    expect(final.scope).toBe("anual");
    expect(final.eligibility).toEqual({
      kind: "limite-de-pontuacao",
      threshold: 50,
      basis: "resultado-anual",
    });
    expect(final.maxScore).toBe(100);
    expect(final.prevalence).toBe("maior-resultado");
  });

  it("7. consolidação entre múltiplos registros da recuperação final permanece pendente", () => {
    const rule = ejaFases69();
    expect(rule.finalRecovery!.aggregation).toBeUndefined();
    const codes = requiredPendingDefinitions(rule).map((p) => p.code);
    expect(codes).toContain("recuperacao-final-formula");
  });

  it("8. arredondamento convencional confirmado no período e no fechamento da fase", () => {
    const rounding = ejaFases69().rounding;
    expect(rounding.mode).toBe("meio-acima");
    expect(rounding.decimals).toBe(0);
    expect(rounding.applyAt).toEqual(["periodo", "anual"]);
  });

  it("9. transferências externas entram na composição como valor administrativo", () => {
    const entries = ejaFases69().administrativeEntries;
    expect(entries.accepted).toBe(true);
    expect(entries.acceptedOrigins).toContain("transferencia-externa");
  });

  it("10. vigência não confirmada: permanece pendência obrigatória", () => {
    const rule = ejaFases69();
    expect(rule.validFrom).toBeUndefined();
    expect(requiredPendingDefinitions(rule).some((p) => p.code === "vigencia-inicio")).toBe(true);
  });

  it("11. rascunho incompleto: revisão e homologação recusadas", () => {
    const rule = ejaFases69();
    expect(isRuleIncomplete(rule)).toBe(true);
    const pending = requiredPendingDefinitions(rule).length;
    const review = transitionRule(rule, supervisao, "enviar-revisao", {
      requiredPending: pending,
    });
    expect(review.ok).toBe(false);
    const homologation = transitionRule(rule, supervisao, "homologar", {
      requiredPending: pending,
    });
    expect(homologation.ok).toBe(false);
  });
});

const ei = () => {
  const rule = createAssessmentRuleFixtures().find((r) => r.id === "rav-ei");
  expect(rule).toBeDefined();
  return rule as InstitutionalAssessmentRule;
};

describe("12F.3 — regra real em elaboração (Educação Infantil)", () => {
  it("1. nasce em rascunho, no calendário Regular, vigência 2027, nunca homologada", () => {
    const rule = ei();
    expect(rule.status).toBe("rascunho");
    expect(rule.scope.calendarId).toBe("cal-rede-2027-regular");
    expect(rule.scope.stageIds).toEqual(["etp-demo-ei"]);
    expect(rule.validFrom).toBe("2027-01-01");
  });

  it("2. estratégia qualitativa/descritiva, sem notas nem médias", () => {
    const rule = ei();
    expect(rule.strategy).toBe("acompanhamento");
    expect(rule.scaleSemantics).toBe("descritiva");
    expect(rule.allowsGrades).toBe(false);
    expect(rule.usesPedagogicalRecords).toBe(true);
    expect(rule.scales[0]).toMatchObject({ kind: "descritiva" });
  });

  it("3. acompanhamento por descritores: sem categorias, pesos ou composição numérica", () => {
    const rule = ei();
    expect(rule.categories).toEqual([]);
    expect(rule.periodMaxScore).toBeUndefined();
  });

  it("4. não existe recuperação: nenhuma estrutura periódica ou final é cadastrada", () => {
    const rule = ei();
    expect(rule.periodicRecovery).toBeUndefined();
    expect(rule.finalRecovery).toBeUndefined();
  });

  it("5. sem arredondamento: avaliação qualitativa não tem pontos numéricos", () => {
    const rounding = ei().rounding;
    expect(rounding.mode).toBe("sem-arredondamento");
    expect(rounding.applyAt).toEqual([]);
  });

  it("6. registros externos de crianças transferidas são aceitos", () => {
    const entries = ei().administrativeEntries;
    expect(entries.accepted).toBe(true);
    expect(entries.acceptedOrigins).toContain("transferencia-externa");
  });

  it("7. sem pendências obrigatórias identificadas no levantamento", () => {
    expect(requiredPendingDefinitions(ei())).toEqual([]);
  });

  it("8. permanece em rascunho nesta etapa: nunca homologada", () => {
    const rule = ei();
    const pending = requiredPendingDefinitions(rule).length;
    const homologation = transitionRule(rule, supervisao, "homologar", {
      requiredPending: pending,
    });
    // Sem pendências obrigatórias a transição é tecnicamente possível, mas
    // esta etapa NÃO homologa: o status cadastrado segue rascunho.
    expect(rule.status).toBe("rascunho");
    expect(homologation.ok).toBe(true);
  });
});
