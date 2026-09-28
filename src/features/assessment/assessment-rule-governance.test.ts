/**
 * Etapa 12F — testes de governança, validação, versionamento, comparação,
 * prévia, simulação e integração com o motor (12E).
 *
 * Princípio verificado em toda a suíte: o SIGEM é CAPAZ de representar muitas
 * regras; a regra CONFIGURADA é dado; só a regra HOMOLOGADA é oficial.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { calendarRepository } from "@/features/calendar/calendar-store";
import { consolidateCycleComposition, composePeriod, roundScore } from "./assessment-composition";
import { applyPeriodicRecovery, applyRecovery } from "./assessment-recovery";
import { compositionInputsForStudent } from "./assessment-composition-projection";
import {
  canRemoveRule,
  duplicateRule,
  mutateRule,
  ruleCapabilities,
  transitionRule,
} from "./assessment-rule-governance";
import { createAssessmentRuleFixtures, assessmentRuleActors } from "./assessment-rule-fixtures";
import {
  compositionModelFromRule,
  officialModelFromRule,
  resolveApplicableRule,
  ruleFuelsEngine,
} from "./assessment-rule-model";
import { compareRules, describeRule, simulateRule } from "./assessment-rule-preview";
import { createInMemoryAssessmentRuleRepository } from "./assessment-rule-store";
import { validateRule } from "./assessment-rule-validation";
import { instrumentTypes, assessmentConfigurations } from "./assessment-fixtures";
import type { InstitutionalAssessmentRule, RecoveryRule } from "./assessment-rule-types";
import type { AssessmentConfiguration } from "./assessment-types";
import type { CompositionEntryInput, CompositionModel } from "./assessment-composition-types";

const { supervisao, direcao, professor } = assessmentRuleActors;
const calendar = calendarRepository.get("cal-rede-2027-regular");
const ctx = { calendar, instrumentTypeIds: instrumentTypes.map((t) => t.id) };

const numericRule = (): InstitutionalAssessmentRule => {
  const base = createAssessmentRuleFixtures()[0]!;
  return {
    ...base,
    categories: base.categories.map((c) => ({ ...c })),
    validFrom: "2027-02-04",
    validUntil: "2027-12-17",
  };
};

const homologate = (rule: InstitutionalAssessmentRule) => {
  const review = transitionRule(rule, supervisao, "enviar-revisao");
  expect(review.ok).toBe(true);
  const done = transitionRule(
    (review as { rule: InstitutionalAssessmentRule }).rule,
    supervisao,
    "homologar",
  );
  expect(done.ok).toBe(true);
  return {
    configurationId: "cfg-teste",
    configurationVersion: 1,
    ...(done as { rule: InstitutionalAssessmentRule }).rule,
  };
};

const configurationFor = (rule: InstitutionalAssessmentRule): AssessmentConfiguration => ({
  ...assessmentConfigurations[0]!,
  // Vínculo explícito declarado no teste (cfg-teste@1), nunca rule.id/rule.version.
  id: rule.configurationId ?? "cfg-teste",
  version: rule.configurationVersion ?? 1,
  pendingRuleIds: [],
  allowsGrades: true,
  usesPedagogicalRecords: false,
});

const entry = (
  over: Partial<CompositionEntryInput> & { entryId: string; periodId: string },
): CompositionEntryInput => ({
  instrumentId: `ins-${over.entryId}`,
  instrumentTypeId: "it-prova",
  configurationId: "cfg-teste",
  configurationVersion: 1,
  status: "registrado",
  value: { kind: "numerica", value: 100 },
  ...over,
});

// ------------------------------------------------------------- 1 a 10

describe("12F — ciclo de vida institucional", () => {
  it("1. rascunho é editável pela Supervisão", () => {
    const result = mutateRule(numericRule(), supervisao, {
      kind: "identificacao",
      patch: { name: "Cenário renomeado" },
    });
    expect(result.ok && result.rule.name).toBe("Cenário renomeado");
  });

  it("2. escola/direção não edita a regra institucional", () => {
    const result = mutateRule(numericRule(), direcao, {
      kind: "identificacao",
      patch: { name: "X" },
    });
    expect(result.ok).toBe(false);
    expect(ruleCapabilities(direcao, numericRule()).edit).toBe(false);
  });

  it("3. professor não edita a regra institucional", () => {
    const result = mutateRule(numericRule(), professor, {
      kind: "adicionar-categoria",
      label: "Nova",
    });
    expect(result.ok).toBe(false);
    expect(ruleCapabilities(professor, numericRule()).edit).toBe(false);
  });

  it("4. em revisão bloqueia edição e permite consulta", () => {
    const review = transitionRule(numericRule(), supervisao, "enviar-revisao");
    expect(review.ok).toBe(true);
    const rule = (review as { rule: InstitutionalAssessmentRule }).rule;
    expect(rule.status).toBe("em-revisao");
    expect(mutateRule(rule, supervisao, { kind: "identificacao", patch: { name: "Y" } }).ok).toBe(
      false,
    );
    expect(ruleCapabilities(supervisao, rule).preview).toBe(true);
  });

  it("5. revisão devolvida volta a rascunho editável", () => {
    const review = transitionRule(numericRule(), supervisao, "enviar-revisao");
    const back = transitionRule(
      (review as { rule: InstitutionalAssessmentRule }).rule,
      supervisao,
      "devolver-rascunho",
    );
    expect(back.ok && back.rule.status).toBe("rascunho");
    expect(
      mutateRule((back as { rule: InstitutionalAssessmentRule }).rule, supervisao, {
        kind: "identificacao",
        patch: { name: "Ajustada" },
      }).ok,
    ).toBe(true);
  });

  it("6. regra homologada é imutável", () => {
    const rule = homologate(numericRule());
    expect(Object.isFrozen(rule)).toBe(true);
    const attempt = mutateRule(rule, supervisao, { kind: "adicionar-categoria", label: "Extra" });
    expect(attempt.ok).toBe(false);
    expect(attempt.ok === false && attempt.reason).toContain("imutável");
    expect(rule.categories).toHaveLength(2);
  });

  it("7. regra homologada não retorna a rascunho", () => {
    const rule = homologate(numericRule());
    const back = transitionRule(rule, supervisao, "devolver-rascunho");
    expect(back.ok).toBe(false);
    expect(back.ok === false && back.reason).toContain("Duplique");
  });

  it("8. regra arquivada é somente leitura", () => {
    const archived = transitionRule(homologate(numericRule()), supervisao, "arquivar");
    expect(archived.ok && archived.rule.status).toBe("arquivada");
    const rule = (archived as { rule: InstitutionalAssessmentRule }).rule;
    expect(mutateRule(rule, supervisao, { kind: "identificacao", patch: { name: "Z" } }).ok).toBe(
      false,
    );
    expect(ruleCapabilities(supervisao, rule).edit).toBe(false);
  });

  it("9. duplicação cria novo identificador e novo rascunho", () => {
    const original = homologate(numericRule());
    const copy = duplicateRule(original, supervisao);
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    expect(copy.rule.id).not.toBe(original.id);
    expect(copy.rule.status).toBe("rascunho");
    expect(copy.rule.version).toBe(original.version + 1);
    expect(copy.rule.originRuleId).toBe(original.id);
  });

  it("10. duplicação não altera o original", () => {
    const original = homologate(numericRule());
    const snapshot = JSON.stringify(original);
    const copy = duplicateRule(original, supervisao, { name: "Outra" });
    expect(copy.ok).toBe(true);
    if (copy.ok)
      expect(
        mutateRule(copy.rule, supervisao, { kind: "adicionar-categoria", label: "Nova" }).ok,
      ).toBe(true);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("exclusão só de rascunho nunca utilizado", () => {
    expect(canRemoveRule(numericRule(), false).allowed).toBe(true);
    expect(canRemoveRule(numericRule(), true).allowed).toBe(false);
    expect(canRemoveRule(homologate(numericRule()), false).allowed).toBe(false);
  });
});

// ------------------------------------------------------------ 11 a 19

describe("12F — identidade estável e validação", () => {
  it("11. renomear categoria preserva o identificador", () => {
    const rule = numericRule();
    const id = rule.categories[0]!.id;
    const result = mutateRule(rule, supervisao, {
      kind: "atualizar-categoria",
      categoryId: id,
      patch: { label: "Nome completamente novo", id: "tentativa-de-troca" },
    });
    expect(result.ok && result.rule.categories[0]!.id).toBe(id);
    expect(result.ok && result.rule.categories[0]!.label).toBe("Nome completamente novo");
  });

  it("12. reordenar categorias preserva os identificadores", () => {
    const rule = numericRule();
    const [first, second] = rule.categories;
    const result = mutateRule(rule, supervisao, {
      kind: "mover-categoria",
      categoryId: first!.id,
      direction: 1,
    });
    expect(result.ok && result.rule.categories.map((c) => c.id)).toEqual([second!.id, first!.id]);
  });

  it("13. quantidade mínima indefinida permanece indefinida", () => {
    const rule = numericRule();
    expect(rule.categories[0]!.minimumEntries).toBeUndefined();
    const result = mutateRule(rule, supervisao, {
      kind: "atualizar-categoria",
      categoryId: rule.categories[0]!.id,
      patch: { weight: 3 },
    });
    expect(result.ok && result.rule.categories[0]!.minimumEntries).toBeUndefined();
    const validation = validateRule(rule, ctx);
    // Passou a ser uma definição PENDENTE (não obrigatória), nunca um erro.
    const pendingMinimum = validation.pending.find((item) =>
      item.code.startsWith("categoria-minimo-"),
    );
    expect(pendingMinimum?.required).toBe(false);
    expect(validation.errors.some((e) => e.code === "quantidade-minima-indefinida")).toBe(false);
  });

  it("14. recuperação referencia categorias por identificador", () => {
    const rule = numericRule();
    const recovery: RecoveryRule = {
      id: "rec-periodica",
      enabled: true,
      scope: "periodo",
      replacesCategoryIds: [rule.categories[0]!.id],
      instrumentTypeIds: ["it-prova"],
      prevalence: "maior-resultado",
      aggregation: { kind: "maior-valor" },
      normativeStatus: "configurado",
    };
    const withRecovery = mutateRule(rule, supervisao, { kind: "recuperacao-periodica", recovery });
    expect(withRecovery.ok).toBe(true);
    if (!withRecovery.ok) return;
    const renamed = mutateRule(withRecovery.rule, supervisao, {
      kind: "atualizar-categoria",
      categoryId: rule.categories[0]!.id,
      patch: { label: "Outro nome" },
    });
    expect(renamed.ok && renamed.rule.periodicRecovery?.replacesCategoryIds).toEqual([
      rule.categories[0]!.id,
    ]);
    expect(
      validateRule((renamed as { rule: InstitutionalAssessmentRule }).rule, ctx).errors,
    ).toHaveLength(0);
  });

  it("15. categoria inexistente na recuperação bloqueia a homologação", () => {
    const rule = numericRule();
    const broken: InstitutionalAssessmentRule = {
      ...rule,
      periodicRecovery: {
        id: "rec",
        enabled: true,
        scope: "periodo",
        replacesCategoryIds: ["cat-que-nao-existe"],
        instrumentTypeIds: ["it-prova"],
        prevalence: "maior-resultado",
        aggregation: { kind: "maior-valor" },
        normativeStatus: "configurado",
      },
    };
    const validation = validateRule(broken, ctx);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.code === "recuperacao-categoria-inexistente")).toBe(
      true,
    );
    const review = transitionRule(broken, supervisao, "enviar-revisao", {
      blockingErrors: validation.errors.length,
    });
    expect(review.ok).toBe(false);
  });

  it("16. tipos de instrumento inválidos bloqueiam a homologação", () => {
    const rule = numericRule();
    const broken = {
      ...rule,
      categories: [{ ...rule.categories[0]!, instrumentTypeIds: ["it-inexistente"] }],
    };
    const validation = validateRule(broken, ctx);
    expect(validation.errors.some((e) => e.code === "tipo-instrumento-inexistente")).toBe(true);
    const inReview = transitionRule(rule, supervisao, "enviar-revisao");
    const attempt = transitionRule(
      (inReview as { rule: InstitutionalAssessmentRule }).rule,
      supervisao,
      "homologar",
      { blockingErrors: validation.errors.length },
    );
    expect(attempt.ok).toBe(false);
  });

  it("17. período de outro calendário bloqueia a homologação", () => {
    const rule = {
      ...numericRule(),
      cycleAggregation: { kind: "media-ponderada" as const },
      cyclePeriodWeights: [{ calendarPeriodId: "per-de-outro-calendario", weight: 1 }],
    };
    const validation = validateRule(rule, ctx);
    expect(validation.errors.some((e) => e.code === "periodo-de-outro-calendario")).toBe(true);
  });

  it("18. estratégia sem notas rejeita composição numérica", () => {
    const acompanhamento = createAssessmentRuleFixtures()[1]!;
    const invalid: InstitutionalAssessmentRule = {
      ...acompanhamento,
      categories: [
        {
          id: "cat-x",
          label: "Categoria",
          instrumentTypeIds: ["it-prova"],
          weight: 1,
          aggregation: { kind: "soma" },
        },
      ],
      periodMaxScore: 100,
      rounding: { ...acompanhamento.rounding, mode: "meio-acima", applyAt: ["periodo"] },
    };
    const validation = validateRule(invalid, ctx);
    expect(validation.errors.map((e) => e.code)).toContain("acompanhamento-com-categorias");
    expect(validation.errors.map((e) => e.code)).toContain("acompanhamento-com-teto");
    expect(validation.errors.map((e) => e.code)).toContain("arredondamento-sem-nota");
  });

  it("19. configuração de acompanhamento não recebe nota", () => {
    const acompanhamento = homologate(createAssessmentRuleFixtures()[1]!);
    const configuration: AssessmentConfiguration = {
      ...configurationFor(acompanhamento),
      allowsGrades: false,
      usesPedagogicalRecords: true,
    };
    const outcome = consolidateCycleComposition({
      configuration,
      model: compositionModelFromRule(acompanhamento),
      periods: [{ id: "p1" }],
      entries: [],
      official: true,
    });
    expect(outcome.kind).toBe("nao-aplicavel");
    const sandbox = simulateRule(acompanhamento, { categoryValues: {} });
    expect(sandbox.blocked).toContain("não utiliza notas");
    expect(validateRule(acompanhamento, ctx).errors).toHaveLength(0);
  });
});

// ------------------------------------------------------------ 20 a 25

describe("12F — arredondamento e configurabilidade", () => {
  const policy = {
    id: "arr",
    mode: "meio-acima" as const,
    decimals: 0,
    applyAt: ["periodo" as const],
    normativeStatus: "homologado" as const,
  };

  it("20. arredondamento matemático convencional", () => {
    const cases: Array<[number, number]> = [
      [49.1, 49],
      [49.4, 49],
      [49.5, 50],
      [49.6, 50],
      [51, 51],
      [55.4, 55],
      [55.5, 56],
    ];
    for (const [input, expected] of cases)
      expect(roundScore(input, policy, "periodo").value).toBe(expected);
  });

  it("21. momento de arredondamento é respeitado", () => {
    expect(roundScore(49.5, policy, "categoria").rounded).toBe(false);
    expect(roundScore(49.5, policy, "categoria").value).toBe(49.5);
    expect(roundScore(49.5, policy, "periodo").rounded).toBe(true);
  });

  it("22. operações intermediárias preservam a precisão", () => {
    const rule: InstitutionalAssessmentRule = {
      ...numericRule(),
      periodAggregation: { kind: "media-simples" },
      rounding: { ...policy, applyAt: ["periodo"] },
    };
    const sandbox = simulateRule(rule, {
      categoryValues: { [rule.categories[0]!.id]: 7.25, [rule.categories[1]!.id]: 8.4 },
    });
    expect(sandbox.categories[0]!.stage!.value).toBe(7.25);
    expect(sandbox.categories[1]!.stage!.value).toBe(8.4);
    expect(sandbox.period!.raw).toBeCloseTo(7.825, 10);
    expect(sandbox.period!.value).toBe(8);
  });

  it("23. 51 permanece 51", () => {
    expect(roundScore(51, policy, "periodo").value).toBe(51);
    expect(roundScore(51, { ...policy, mode: "passo", step: 0.5 }, "periodo").value).toBe(51);
  });

  it("24. estruturas 4×100, 3×100 e 100+100+200 funcionam sem alterar código", () => {
    const rule = homologate({
      ...numericRule(),
      categories: [
        {
          id: "cat-unica",
          label: "Categoria única",
          instrumentTypeIds: ["it-prova"],
          weight: 1,
          aggregation: { kind: "soma" },
        },
      ],
      periodAggregation: { kind: "soma" },
      cycleAggregation: { kind: "soma" },
    });
    const model = officialModelFromRule(rule)!;
    const configuration = configurationFor(rule);
    const run = (periodIds: string[], entries: CompositionEntryInput[]) =>
      consolidateCycleComposition({
        configuration,
        model,
        periods: periodIds.map((id) => ({ id })),
        entries,
        official: true,
      });

    const four = run(
      ["p1", "p2", "p3", "p4"],
      ["p1", "p2", "p3", "p4"].map((p, i) => entry({ entryId: `e${i}`, periodId: p })),
    );
    expect(four.kind).toBe("resultado-anual-original");
    expect(four.kind === "resultado-anual-original" && four.stage.value).toBe(400);

    const three = run(
      ["p1", "p2", "p3"],
      ["p1", "p2", "p3"].map((p, i) => entry({ entryId: `t${i}`, periodId: p })),
    );
    expect(three.kind === "resultado-anual-original" && three.stage.value).toBe(300);

    const asymmetric = run(
      ["p1", "p2", "p3"],
      [
        entry({ entryId: "a1", periodId: "p1" }),
        entry({ entryId: "a2", periodId: "p2" }),
        entry({ entryId: "a3", periodId: "p3" }),
        entry({ entryId: "a4", periodId: "p3" }),
      ],
    );
    expect(asymmetric.kind === "resultado-anual-original" && asymmetric.stage.value).toBe(400);
  });

  it("25. nenhum total anual, percentual de corte ou sigla está fixado no código", () => {
    const files = [
      "assessment-rule-types.ts",
      "assessment-rule-governance.ts",
      "assessment-rule-validation.ts",
      "assessment-rule-model.ts",
      "assessment-rule-preview.ts",
      "assessment-recovery.ts",
    ];
    for (const file of files) {
      const source = readFileSync(`src/features/assessment/${file}`, "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
      expect(code).not.toMatch(/\b(?:200|300|400)\b/);
      expect(code).not.toMatch(/\bAV[12]\b/);
      expect(code).not.toMatch(/aprovad|reprovad|retid/i);
      expect(code).not.toMatch(/bimestr/i);
      expect(code).not.toMatch(/\b20(?:2[0-9]|3[0-9])\b/);
    }
  });
});

// ------------------------------------------------------------ 26 a 29

describe("12F — valores, ausências e histórico", () => {
  it("26. transferência externa não recebe conversão especial", () => {
    const rule = homologate({
      ...numericRule(),
      administrativeEntries: {
        accepted: true,
        acceptedOrigins: ["transferencia-externa"],
        normativeStatus: "configurado",
      },
    });
    const model = officialModelFromRule(rule)!;
    const period = composePeriod({
      model,
      period: { id: "p1" },
      entries: [
        entry({
          entryId: "ext",
          periodId: "p1",
          origin: "transferencia-externa",
          metadata: { rede: "Outra rede" },
          value: { kind: "numerica", value: 73 },
        }),
        entry({
          entryId: "loc",
          periodId: "p1",
          instrumentTypeId: "it-atividade",
          value: { kind: "numerica", value: 10 },
        }),
      ],
      official: true,
    });
    const external = period.categories.find((c) => c.origins.includes("transferencia-externa"));
    expect(external?.stage?.value).toBe(73);

    const strict = composePeriod({
      model: {
        ...model,
        administrativeEntries: {
          accepted: false,
          acceptedOrigins: [],
          normativeStatus: "pendente",
        },
      },
      period: { id: "p1" },
      entries: [entry({ entryId: "ext", periodId: "p1", origin: "transferencia-externa" })],
      official: true,
    });
    expect(strict.missing.some((m) => m.kind === "origem-nao-admitida")).toBe(true);
  });

  it('27. "não registrado" não vira zero', () => {
    const rule = homologate(numericRule());
    const period = composePeriod({
      model: officialModelFromRule(rule)!,
      period: { id: "p1" },
      entries: [
        entry({
          entryId: "nr",
          periodId: "p1",
          value: { kind: "nao-registrado", reason: "Ausência justificada" },
        }),
      ],
      official: true,
    });
    expect(period.missing.some((m) => m.kind === "nao-registrado-sem-regra")).toBe(true);
    expect(period.categories[0]!.stage).toBeNull();
    expect(period.complete).toBe(false);
  });

  it("28. configuração histórica não é reinterpretada", () => {
    const v1 = homologate(numericRule());
    const duplicated = duplicateRule(v1, supervisao);
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) return;
    const v2 = homologate(duplicated.rule);
    const outcome = consolidateCycleComposition({
      configuration: configurationFor(v1),
      model: officialModelFromRule(v2)!,
      periods: [{ id: "p1" }],
      entries: [entry({ entryId: "old", periodId: "p1", configurationVersion: 1 })],
      official: true,
    });
    expect(outcome.kind).toBe("bloqueado");
  });

  it("29. lançamento mantém configurationId e configurationVersion", () => {
    const inputs = compositionInputsForStudent({
      studentId: "alu-1",
      instruments: [
        {
          id: "ins-1",
          configurationId: "cfg-antiga",
          configurationVersion: 1,
          periodId: "p1",
          pedagogicalAssignmentId: "atp-001",
          classId: "tur-001",
          instrumentTypeId: "it-prova",
          title: "Registro",
          appliedOn: "2027-03-10",
          snapshot: { classLabel: "Turma", fieldLabel: "Componente" },
        },
      ],
      entries: [
        {
          id: "ent-1",
          instrumentId: "ins-1",
          studentId: "alu-1",
          placement: {
            enrollmentId: "m1",
            academicLinkId: "l1",
            participationId: "pp1",
            allocationId: "a1",
          },
          value: { kind: "numerica", value: 40 },
          recordedAt: "2027-03-11T12:00:00.000Z",
          recordedByAssignmentId: "atp-001",
          status: "registrado",
        },
      ],
    });
    expect(inputs[0]!.configurationId).toBe("cfg-antiga");
    expect(inputs[0]!.configurationVersion).toBe(1);
  });
});

// ------------------------------------------------------------ 30 a 37

describe("12F — integração com o motor, comparação e simulação", () => {
  const model = (rule: InstitutionalAssessmentRule): CompositionModel =>
    compositionModelFromRule(rule);

  it("30. rascunho não alimenta cálculo institucional", () => {
    const rule = numericRule();
    expect(ruleFuelsEngine(rule)).toBe(false);
    expect(officialModelFromRule(rule)).toBeNull();
    const outcome = consolidateCycleComposition({
      configuration: configurationFor(rule),
      model: model(rule),
      periods: [{ id: "p1" }],
      entries: [entry({ entryId: "e1", periodId: "p1" })],
      official: true,
    });
    expect(outcome.kind).toBe("bloqueado");
  });

  it("31. em revisão não alimenta cálculo institucional", () => {
    const review = transitionRule(numericRule(), supervisao, "enviar-revisao");
    const rule = (review as { rule: InstitutionalAssessmentRule }).rule;
    expect(ruleFuelsEngine(rule)).toBe(false);
    const outcome = consolidateCycleComposition({
      configuration: configurationFor(rule),
      model: model(rule),
      periods: [{ id: "p1" }],
      entries: [entry({ entryId: "e1", periodId: "p1" })],
      official: true,
    });
    expect(outcome.kind).toBe("bloqueado");
  });

  it("32. regra homologada alimenta o motor e resolve por contexto", () => {
    const rule = homologate({
      ...numericRule(),
      categories: [
        {
          id: "cat-unica",
          label: "Categoria única",
          instrumentTypeIds: ["it-prova"],
          weight: 1,
          aggregation: { kind: "soma" },
        },
      ],
    });
    const outcome = consolidateCycleComposition({
      configuration: configurationFor(rule),
      model: officialModelFromRule(rule)!,
      periods: [{ id: "p1" }],
      entries: [entry({ entryId: "e1", periodId: "p1" })],
      official: true,
    });
    expect(outcome.kind).toBe("resultado-anual-original");
    expect(outcome.kind === "resultado-anual-original" && outcome.official).toBe(true);

    const resolution = resolveApplicableRule({
      academicYearId: "ano-2027",
      stageId: "etp-demo-anos-iniciais",
      date: "2027-05-10",
      rules: [rule],
    });
    expect(resolution.status).toBe("resolvida");
    const none = resolveApplicableRule({
      academicYearId: "ano-2027",
      stageId: "etp-demo-anos-iniciais",
      rules: [numericRule()],
    });
    expect(none.status).toBe("sem-regra-homologada");
  });

  it("33. configurações diferentes não são combinadas silenciosamente", () => {
    const rule = homologate(numericRule());
    const outcome = consolidateCycleComposition({
      configuration: configurationFor(rule),
      model: officialModelFromRule(rule)!,
      periods: [{ id: "p1" }],
      entries: [
        entry({ entryId: "a", periodId: "p1", configurationId: "cfg-a" }),
        entry({ entryId: "b", periodId: "p1", configurationId: "cfg-b" }),
      ],
      official: true,
    });
    expect(outcome.kind).toBe("bloqueado");
    expect(
      outcome.kind === "bloqueado" &&
        outcome.reasons.some((r) => r.includes("definição administrativa/pedagógica")),
    ).toBe(true);
  });

  it("34. comparação identifica diferenças sem depender de nomes", () => {
    const before = numericRule();
    const renamed = mutateRule(before, supervisao, {
      kind: "atualizar-categoria",
      categoryId: before.categories[0]!.id,
      patch: { label: "Rótulo novo", weight: 4 },
    });
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    const diffs = compareRules(before, renamed.rule);
    expect(diffs.some((d) => d.label.includes("nome") && d.kind === "alterada")).toBe(true);
    expect(diffs.some((d) => d.label.includes("peso"))).toBe(true);
    expect(diffs.some((d) => d.kind === "removida")).toBe(false);

    const removed = mutateRule(before, supervisao, {
      kind: "remover-categoria",
      categoryId: before.categories[0]!.id,
    });
    expect(
      removed.ok && compareRules(before, removed.rule).some((d) => d.kind === "removida"),
    ).toBe(true);
  });

  it("35. simulação não utiliza nem altera dados reais", () => {
    const repo = createInMemoryAssessmentRuleRepository();
    const before = JSON.stringify(repo.list());
    const rule: InstitutionalAssessmentRule = {
      ...numericRule(),
      periodicRecovery: {
        id: "rec",
        enabled: true,
        scope: "periodo",
        replacesCategoryIds: [],
        instrumentTypeIds: ["it-prova"],
        maxScore: 60,
        prevalence: "maior-resultado",
        aggregation: { kind: "maior-valor" },
        normativeStatus: "configurado",
      },
    };
    const result = simulateRule(rule, {
      categoryValues: { [rule.categories[0]!.id]: 20, [rule.categories[1]!.id]: 15 },
      recoveryValue: 80,
    });
    expect(result.notice).toBe("Simulação — nenhum dado de aluno é utilizado ou alterado.");
    expect(result.period!.value).toBe(35);
    // Teto configurado limita a recuperação; prevalência escolhida decide o resto.
    expect(result.recovery!.value).toBe(60);
    expect(result.afterRecovery!.value).toBe(60);
    expect(JSON.stringify(repo.list())).toBe(before);
  });

  it("prevalência é configurável, não uma limitação do domínio", () => {
    const rule = homologate(numericRule());
    const base = {
      model: officialModelFromRule(rule)!,
      point: "periodo" as const,
      entries: [
        entry({
          entryId: "r",
          periodId: "p1",
          instrumentTypeId: "it-producao",
          value: { kind: "numerica", value: 40 },
        }),
      ],
    };
    const original = roundScore(60, rule.rounding, "periodo");
    const recovery = (prevalence: NonNullable<RecoveryRule["prevalence"]>): RecoveryRule => ({
      id: "rec",
      enabled: true,
      scope: "periodo",
      replacesCategoryIds: [],
      instrumentTypeIds: ["it-producao"],
      prevalence,
      aggregation: { kind: "maior-valor" },
      normativeStatus: "configurado",
    });
    expect(
      applyRecovery({ ...base, recovery: recovery("maior-resultado"), original }).afterRecovery!
        .value,
    ).toBe(60);
    expect(
      applyRecovery({ ...base, recovery: recovery("substituicao-direta"), original }).afterRecovery!
        .value,
    ).toBe(40);
    expect(
      applyRecovery({ ...base, recovery: recovery("media-entre-resultados"), original })
        .afterRecovery!.value,
    ).toBe(50);
    // O resultado original nunca é apagado.
    expect(
      applyRecovery({ ...base, recovery: recovery("substituicao-direta"), original }).original!
        .value,
    ).toBe(60);
  });

  it("recuperação periódica substitui apenas as categorias configuradas", () => {
    const rule = homologate({
      ...numericRule(),
      periodAggregation: { kind: "soma" },
      periodicRecovery: {
        id: "rec",
        enabled: true,
        scope: "periodo",
        replacesCategoryIds: ["cat-demo-1"],
        instrumentTypeIds: ["it-producao"],
        prevalence: "maior-resultado",
        aggregation: { kind: "maior-valor" },
        normativeStatus: "configurado",
      },
    });
    const model = officialModelFromRule(rule)!;
    const entries = [
      entry({ entryId: "c1", periodId: "p1", value: { kind: "numerica", value: 10 } }),
      entry({
        entryId: "c2",
        periodId: "p1",
        instrumentTypeId: "it-atividade",
        value: { kind: "numerica", value: 30 },
      }),
    ];
    const period = composePeriod({ model, period: { id: "p1" }, entries, official: true });
    const outcome = applyPeriodicRecovery({
      recovery: rule.periodicRecovery,
      model,
      period,
      entries: [
        entry({
          entryId: "rec",
          periodId: "p1",
          instrumentTypeId: "it-producao",
          value: { kind: "numerica", value: 25 },
        }),
      ],
    });
    expect(period.stage!.value).toBe(40);
    expect(outcome.recovery!.value).toBe(25);
    // Categoria não substituída (30) permanece; a substituída cede lugar a 25.
    expect(outcome.afterRecovery!.value).toBe(55);
    expect(outcome.original!.value).toBe(40);
  });

  it("36. calendário 2027 permanece intacto", () => {
    const regular = calendarRepository.get("cal-rede-2027-regular");
    expect(regular?.periods.map((p) => p.id)).toEqual([
      "per-2027-reg-1",
      "per-2027-reg-2",
      "per-2027-reg-3",
    ]);
    const eja = calendarRepository.get("cal-rede-2027-eja");
    expect(eja?.periods).toHaveLength(4);
    expect(regular?.status).toBe("rascunho");
  });

  it("37. prévia descreve a regra sem afirmar resultado acadêmico", () => {
    const rule = numericRule();
    const sections = describeRule(rule, { calendar, instrumentTypes });
    const text = sections.flatMap((s) => s.lines).join(" ");
    expect(sections.map((s) => s.title)).toContain("Composição do período");
    expect(text).not.toMatch(/aprovad|reprovad|retid/i);
    expect(text).toContain("não homologada");
  });

  it("nenhuma regra real da rede é homologada nas fixtures", () => {
    expect(createAssessmentRuleFixtures().every((r) => r.status === "rascunho")).toBe(true);
    expect(model(createAssessmentRuleFixtures()[0]!).normativeStatus).toBe("configurado");
  });
});
