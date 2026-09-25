/**
 * Etapa 12H — Consolidação do Percurso Avaliativo (domínio puro).
 *
 * Entrada: ciclo JÁ RESOLVIDO (12H/config) × configuração × regra homologada
 * (12F) × versões vigentes dos fechamentos oficiais dos períodos (12G).
 * Saída: resultado matemático do ciclo, recuperação final e resultado
 * pós-recuperação — três informações distintas.
 *
 * O motor NÃO conhece modalidade, etapa, fase, ano civil, quantidade de
 * períodos, nota de corte, frequência, Conselho nem situação acadêmica. Nada é
 * recalculado a partir dos lançamentos: o período já foi consolidado e
 * versionado pela 12G, e a consolidação do ciclo consome essa versão vigente.
 */
import { aggregate, roundScore } from "./assessment-composition";
import type {
  CompositionEntryInput,
  CompositionModel,
  RoundingPolicy,
  RoundingPoint,
} from "./assessment-composition-types";
import { applyRecovery } from "./assessment-recovery";
import { officialModelFromRule } from "./assessment-rule-model";
import type { InstitutionalAssessmentRule, RecoveryRule } from "./assessment-rule-types";
import { curriculumKey, sameCurriculum } from "./assessment-rules";
import type { AssessmentConfiguration, CurriculumRef } from "./assessment-types";
import { closingScopeKey, closingSourceReference, currentClosing } from "./period-closing";
import type { ClosingSourceReference, PeriodClosingRecord } from "./period-closing-types";
import {
  cycleRange,
  type AssessmentCycle,
  type CycleConsolidation,
  type CycleConsolidationFacts,
  type CyclePendency,
  type CyclePeriodContribution,
  type CyclePeriodRef,
  type FinalRecoveryProjection,
  type FinalRecoveryState,
} from "./cycle-consolidation-types";

// ------------------------------------------------- Nomenclatura generalizada

/**
 * Forma de consolidação do CICLO. As regras já cadastradas declaram o campo
 * historicamente chamado `cycleAggregation`; aqui ele é lido como a forma
 * genérica de consolidação do ciclo, sem qualquer vínculo com o ano civil.
 */
export const cycleAggregationOf = (model: CompositionModel) => model.cycleAggregation;

/** Ponto de fechamento do ciclo. "ciclo" é a forma genérica; "anual" o legado. */
export function cycleRoundingPoint(policy: RoundingPolicy): RoundingPoint {
  return policy.applyAt.includes("ciclo") ? "ciclo" : "anual";
}

/** Peso do período na consolidação do ciclo, quando a regra o declarar. */
export function cyclePeriodWeight(
  rule: InstitutionalAssessmentRule | undefined,
  period: CyclePeriodRef,
): number | undefined {
  const declared = rule?.cyclePeriodWeights?.find(
    (w) => w.calendarPeriodId === (period.calendarPeriodId ?? period.periodId),
  );
  return declared?.weight;
}

// ----------------------------------------------------------------- Entrada

export type CycleConsolidationInput = {
  cycle: AssessmentCycle;
  configuration: AssessmentConfiguration;
  studentId: string;
  studentName?: string;
  curriculumRef: CurriculumRef;
  /** Regra aplicável. Só regra homologada consolida o ciclo. */
  rule?: InstitutionalAssessmentRule;
  /** Todas as versões de fechamento conhecidas (12G); a vigente é derivada. */
  closings: readonly PeriodClosingRecord[];
  /** Lançamentos admitidos como registro da recuperação final do ciclo. */
  finalRecoveryEntries?: readonly CompositionEntryInput[];
};

// ------------------------------------------------- Fechamentos por período

const matchesPeriod = (record: PeriodClosingRecord, period: CyclePeriodRef) =>
  period.calendarPeriodId && record.scope.calendarPeriodId
    ? record.scope.calendarPeriodId === period.calendarPeriodId
    : record.scope.periodId === period.periodId;

/**
 * Versões VIGENTES do período para este aluno/componente, em qualquer turma do
 * percurso. Mudança de turma dentro do ciclo é natural: os períodos anteriores
 * permanecem fechados na turma em que ocorreram.
 */
export function currentClosingsForPeriod(args: {
  closings: readonly PeriodClosingRecord[];
  cycle: AssessmentCycle;
  curriculumRef: CurriculumRef;
  period: CyclePeriodRef;
}): PeriodClosingRecord[] {
  const scoped = args.closings.filter(
    (record) =>
      record.scope.academicYearId === args.cycle.academicYearId &&
      sameCurriculum(record.scope.curriculumRef, args.curriculumRef) &&
      matchesPeriod(record, args.period),
  );
  const keys = [...new Set(scoped.map((r) => closingScopeKey(r.scope)))];
  return keys
    .map((key) => currentClosing(scoped, key))
    .filter((r): r is PeriodClosingRecord => Boolean(r));
}

// ----------------------------------------------------------- Recuperação final

type Eligibility = { status: "elegivel" | "nao-elegivel" | "pendente"; reason: string };

/** Elegibilidade DERIVADA do critério configurado. Nenhum patamar é presumido. */
export function finalRecoveryEligibility(args: {
  recovery: RecoveryRule;
  rule: InstitutionalAssessmentRule;
  cycleScore: number;
}): Eligibility {
  const { recovery, rule, cycleScore } = args;
  const eligibility = recovery.eligibility;
  if (!eligibility)
    return {
      status: "pendente",
      reason: "Critério de acesso à recuperação final pendente de definição normativa.",
    };
  if (eligibility.kind === "sem-restricao")
    return { status: "elegivel", reason: "A regra homologada não restringe o acesso." };
  if (eligibility.kind === "limite-de-pontuacao") {
    if (eligibility.threshold === undefined)
      return {
        status: "pendente",
        reason: "Patamar de acesso à recuperação final pendente de definição normativa.",
      };
    if (!eligibility.basis)
      return {
        status: "pendente",
        reason: "A regra não declara sobre qual valor o patamar de acesso é comparado.",
      };
    if (eligibility.basis !== "resultado-anual")
      return {
        status: "pendente",
        reason:
          "O critério de acesso está declarado sobre outra base, não sobre o resultado do ciclo: a aplicação depende de definição normativa.",
      };
    return cycleScore < eligibility.threshold
      ? { status: "elegivel", reason: "Resultado do ciclo abaixo do patamar configurado." }
      : { status: "nao-elegivel", reason: "Resultado do ciclo igual ou acima do patamar configurado." };
  }
  const parameterId = eligibility.minimumParameterId;
  const value = parameterId ? rule.parameters.find((p) => p.id === parameterId)?.value : undefined;
  if (value === undefined)
    return {
      status: "pendente",
      reason:
        "O direito deriva de um mínimo institucional que ainda não foi cadastrado. Nenhum número é presumido.",
    };
  return cycleScore < value
    ? { status: "elegivel", reason: "Resultado do ciclo abaixo do mínimo institucional." }
    : { status: "nao-elegivel", reason: "Resultado do ciclo igual ou acima do mínimo institucional." };
}

// ------------------------------------------------------------------- Motor

export function consolidateCycle(input: CycleConsolidationInput): CycleConsolidation {
  const { cycle, configuration, studentId, curriculumRef } = input;
  const pendencies: CyclePendency[] = [];
  const contributions: CyclePeriodContribution[] = [];
  const sourceClosings: ClosingSourceReference[] = [];

  const facts = (extra: Partial<CycleConsolidationFacts>): CycleConsolidationFacts => ({
    cycleId: cycle.id,
    cycleKindId: cycle.kindId,
    academicYearId: cycle.academicYearId,
    configurationId: configuration.id,
    ...(configuration.version !== undefined ? { configurationVersion: configuration.version } : {}),
    ...(cycle.periodGroupId ? { periodGroupId: cycle.periodGroupId } : {}),
    ...(cycle.calendarId ? { calendarId: cycle.calendarId } : {}),
    studentId,
    curriculumRef,
    curriculumKey: curriculumKey(curriculumRef),
    classIds: [...new Set(contributions.map((c) => c.classId).filter((id): id is string => !!id))],
    periodIds: cycle.periods.map((p) => p.periodId),
    closedPeriodIds: contributions.filter((c) => c.closed).map((c) => c.periodId),
    openPeriodIds: contributions.filter((c) => !c.closed).map((c) => c.periodId),
    ...(input.rule ? { ruleId: input.rule.id, ruleVersion: input.rule.version } : {}),
    sourceClosings,
    pendencyCodes: [...new Set(pendencies.map((p) => p.code))],
    pendingRuleIds: [...new Set(pendencies.flatMap((p) => p.pendingRuleIds ?? []))],
    finalRecoveryState: "nao-configurada",
    official: false,
    ...extra,
  });

  const base = {
    cycle,
    studentId,
    ...(input.studentName ? { studentName: input.studentName } : {}),
    curriculumRef,
    contributions,
    pendencies,
  };

  const blocked = (reasons: string[]): CycleConsolidation => ({
    ...base,
    kind: "bloqueado",
    reasons,
    cycleScore: null,
    finalRecovery: null,
    postRecoveryScore: null,
    academicStanding: null,
    official: false,
    facts: facts({}),
  });

  // 1. Estrutura do ciclo ------------------------------------------------
  if (cycle.periods.length === 0) {
    pendencies.push({
      code: "ciclo-sem-periodos",
      severity: "bloqueante",
      message: "O ciclo avaliativo não declara nenhum período oficial.",
    });
    return blocked(["O ciclo avaliativo não declara nenhum período oficial."]);
  }

  // 2. Configurações não numéricas ---------------------------------------
  if (!configuration.allowsGrades || configuration.usesPedagogicalRecords) {
    const reason =
      "Esta configuração não utiliza notas: o percurso é acompanhado por registros pedagógicos descritivos, sem consolidação numérica nem recuperação final.";
    pendencies.push({
      code: "configuracao-nao-numerica",
      severity: "aviso",
      message: reason,
      pendingRuleIds: ["pn-ei"],
    });
    return {
      ...base,
      kind: "nao-aplicavel",
      reason,
      cycleScore: null,
      finalRecovery: null,
      postRecoveryScore: null,
      academicStanding: null,
      official: false,
      facts: facts({}),
    };
  }

  // 3. Governança da regra ----------------------------------------------
  const model = input.rule ? officialModelFromRule(input.rule) : null;
  if (!input.rule || !model) {
    pendencies.push({
      code: "regra-nao-homologada",
      severity: "bloqueante",
      message:
        "Não há regra avaliativa homologada aplicável a este percurso. Sem ato normativo homologado não existe consolidação do ciclo.",
      pendingRuleIds: ["pn-consolidacao"],
    });
    return blocked([
      "Não há regra avaliativa homologada aplicável a este percurso. Sem ato normativo homologado não existe consolidação do ciclo.",
    ]);
  }
  const rule = input.rule;

  const aggregation = cycleAggregationOf(model);
  if (!aggregation) {
    pendencies.push({
      code: "forma-de-consolidacao-do-ciclo-nao-definida",
      severity: "bloqueante",
      message:
        "A forma de consolidação do ciclo ainda não foi definida normativamente: nenhum cálculo é presumido.",
      pendingRuleIds: ["pn-consolidacao-anual"],
    });
    return blocked([
      "A forma de consolidação do ciclo ainda não foi definida normativamente: nenhum cálculo é presumido.",
    ]);
  }

  if (!cycle.calendarId || cycle.periods.some((p) => !p.official)) {
    pendencies.push({
      code: "calendario-nao-homologado",
      severity: "bloqueante",
      message:
        "O ciclo reúne períodos que não vêm de calendário escolar homologado. Sem período oficial não existe consolidação oficial.",
    });
    return blocked([
      "O ciclo reúne períodos que não vêm de calendário escolar homologado. Sem período oficial não existe consolidação oficial.",
    ]);
  }

  // 4. Contribuição de cada período, pela versão vigente da 12G ----------
  for (const period of cycle.periods) {
    const vigentes = currentClosingsForPeriod({
      closings: input.closings,
      cycle,
      curriculumRef,
      period,
    });
    const declaredWeight = cyclePeriodWeight(rule, period);
    const weight = declaredWeight ?? 1;
    if (aggregation.kind === "media-ponderada" && declaredWeight === undefined)
      pendencies.push({
        code: "forma-de-consolidacao-do-ciclo-nao-definida",
        severity: "bloqueante",
        message: `A consolidação ponderada exige peso declarado para "${period.label}", e a regra homologada não o declara.`,
        periodId: period.periodId,
        pendingRuleIds: ["pn-consolidacao"],
      });

    const commonRef = {
      periodId: period.periodId,
      ...(period.calendarPeriodId ? { calendarPeriodId: period.calendarPeriodId } : {}),
      sequence: period.sequence,
      label: period.label,
      weight,
    };

    if (vigentes.length === 0) {
      contributions.push({
        ...commonRef,
        closed: false,
        periodScore: null,
        rounded: false,
        coverage: null,
        unregistered: [],
      });
      pendencies.push({
        code: "periodo-sem-fechamento-oficial",
        severity: "bloqueante",
        message: `"${period.label}" ainda não possui fechamento oficial homologado. Enquanto isso, o ciclo permanece como acumulado parcial.`,
        periodId: period.periodId,
        ...(period.calendarPeriodId ? { calendarPeriodId: period.calendarPeriodId } : {}),
      });
      continue;
    }
    if (vigentes.length > 1) {
      pendencies.push({
        code: "periodo-com-fechamentos-concorrentes",
        severity: "pendencia-administrativa",
        message: `"${period.label}" possui mais de um fechamento oficial vigente no percurso do aluno. O aproveitamento depende de decisão administrativa/pedagógica.`,
        periodId: period.periodId,
        pendingRuleIds: ["pn-movimentacao"],
      });
    }

    const record = vigentes[vigentes.length - 1]!;
    const result = record.results.find((r) => r.studentId === studentId);
    sourceClosings.push(closingSourceReference(record));

    if (!result) {
      contributions.push({
        ...commonRef,
        classId: record.scope.classId,
        closed: true,
        closingId: record.id,
        closingVersion: record.version,
        periodScore: null,
        rounded: false,
        coverage: null,
        unregistered: [],
        configurationId: record.configurationId,
        ...(record.configurationVersion !== undefined
          ? { configurationVersion: record.configurationVersion }
          : {}),
        ruleId: record.ruleId,
        ruleVersion: record.ruleVersion,
      });
      pendencies.push({
        code: "periodo-sem-resultado-do-aluno",
        severity: "pendencia-administrativa",
        message: `O aluno não possui resultado consolidado em "${period.label}" (ingresso posterior ou documentação não regularizada). Nenhum zero, proporcionalidade, equivalência ou resultado presumido é gerado: a consolidação aguarda regularização.`,
        periodId: period.periodId,
        classId: record.scope.classId,
        pendingRuleIds: ["pn-movimentacao"],
      });
      continue;
    }

    contributions.push({
      ...commonRef,
      classId: record.scope.classId,
      closed: true,
      closingId: record.id,
      closingVersion: record.version,
      periodScore: result.consolidatedPeriodScore,
      rounded: result.rounded,
      coverage: result.coverage,
      unregistered: result.unregistered,
      configurationId: record.configurationId,
      ...(record.configurationVersion !== undefined
        ? { configurationVersion: record.configurationVersion }
        : {}),
      ruleId: record.ruleId,
      ruleVersion: record.ruleVersion,
    });

    if (result.coverage !== "integral")
      pendencies.push({
        code: "periodo-sem-cobertura-integral",
        severity: "pendencia-administrativa",
        message: `Cobertura não integral em "${period.label}" (${result.coverage}). O aproveitamento depende de decisão administrativa/pedagógica.`,
        periodId: period.periodId,
        classId: record.scope.classId,
        pendingRuleIds: ["pn-movimentacao"],
      });
    if (result.unregistered.length > 0)
      pendencies.push({
        code: "resultado-nao-registrado-no-periodo",
        severity: "pendencia-administrativa",
        message: `"${period.label}" possui registro declarado como "não registrado" com motivo. Nunca é convertido em zero: o aproveitamento depende de decisão administrativa/pedagógica.`,
        periodId: period.periodId,
        pendingRuleIds: ["pn-movimentacao"],
      });
    if (result.consolidatedPeriodScore === null || !result.complete)
      pendencies.push({
        code: "periodo-sem-resultado-do-aluno",
        severity: "pendencia-administrativa",
        message: `"${period.label}" foi fechado sem resultado consolidado completo para este aluno. Nenhum valor é presumido.`,
        periodId: period.periodId,
        pendingRuleIds: ["pn-movimentacao"],
      });
  }

  // 5. Divergência de configuração/regra ao longo do ciclo ---------------
  const configurationSignatures = new Set(
    contributions
      .filter((c) => c.closed && c.configurationId)
      .map((c) => `${c.configurationId}@${c.configurationVersion ?? "?"}`),
  );
  if (configurationSignatures.size > 1)
    pendencies.push({
      code: "configuracao-divergente-entre-periodos",
      severity: "pendencia-administrativa",
      message:
        "O percurso reúne períodos fechados sob configurações avaliativas diferentes. Nenhuma equivalência ou conversão é presumida: a consolidação depende de decisão administrativa/pedagógica.",
      pendingRuleIds: ["pn-movimentacao"],
    });
  const ruleSignatures = new Set(
    contributions.filter((c) => c.closed && c.ruleId).map((c) => `${c.ruleId}@${c.ruleVersion}`),
  );
  if (ruleSignatures.size > 1)
    pendencies.push({
      code: "regra-divergente-entre-periodos",
      severity: "pendencia-administrativa",
      message:
        "O percurso reúne períodos fechados sob versões diferentes da regra avaliativa. A consolidação depende de decisão administrativa/pedagógica, sem reinterpretação retroativa.",
      pendingRuleIds: ["pn-movimentacao"],
    });

  const administrative = pendencies.filter((p) => p.severity === "pendencia-administrativa");
  const blockingList = pendencies.filter((p) => p.severity === "bloqueante");

  if (administrative.length > 0)
    return {
      ...base,
      kind: "pendencia-administrativa",
      reasons: administrative.map((p) => p.message),
      cycleScore: null,
      finalRecovery: null,
      postRecoveryScore: null,
      academicStanding: null,
      official: false,
      facts: facts({}),
    };

  const values = contributions
    .filter((c) => c.closed && c.periodScore !== null)
    .map((c) => ({ value: c.periodScore as number, weight: c.weight, at: c.periodId }));

  const open = contributions.filter((c) => !c.closed);
  if (open.length > 0) {
    const partial = aggregate(aggregation, values);
    return {
      ...base,
      kind: "acumulado-parcial",
      label: "Acumulado parcial — o ciclo avaliativo ainda não está completo",
      partialScore: partial,
      cycleScore: null,
      finalRecovery: null,
      postRecoveryScore: null,
      academicStanding: null,
      official: false,
      facts: facts({}),
    };
  }

  if (blockingList.length > 0) return blocked(blockingList.map((p) => p.message));

  const raw = aggregate(aggregation, values);
  if (raw === null) return blocked(["Não há resultados de período aproveitáveis neste ciclo."]);

  // 6. Resultado matemático consolidado do ciclo -------------------------
  const point = cycleRoundingPoint(model.rounding);
  const cycleStage = roundScore(raw, model.rounding, point);

  // 7. Recuperação final, em camada própria -----------------------------
  const recovery = rule.finalRecovery;
  const entries = input.finalRecoveryEntries ?? [];
  let projection: FinalRecoveryProjection = {
    state: "nao-configurada",
    recoveryScore: null,
    prevalence: null,
    entryIds: [],
    reason: "Nenhuma recuperação final configurada nesta regra.",
  };
  let post: { value: number; rounded: boolean } | null = {
    value: cycleStage.value,
    rounded: cycleStage.rounded,
  };

  const setPending = (state: FinalRecoveryState, reason: string) => {
    projection = {
      state,
      recoveryScore: null,
      prevalence: recovery?.prevalence ?? null,
      entryIds: [],
      ...(recovery?.maxScore !== undefined ? { maxScore: recovery.maxScore } : {}),
      reason,
    };
    post = null;
  };

  if (recovery && !recovery.enabled) {
    projection = { ...projection, state: "desabilitada", reason: "Recuperação final desabilitada nesta regra." };
  } else if (recovery) {
    const eligibility = finalRecoveryEligibility({ recovery, rule, cycleScore: cycleStage.value });
    if (eligibility.status === "pendente") {
      setPending("pendente-de-definicao", eligibility.reason);
      pendencies.push({
        code: "recuperacao-final-pendente-de-definicao",
        severity: "bloqueante",
        message: `${eligibility.reason} O resultado pós-recuperação permanece bloqueado.`,
        pendingRuleIds: ["pn-recuperacao"],
      });
    } else if (eligibility.status === "nao-elegivel") {
      projection = {
        state: "nao-elegivel",
        recoveryScore: null,
        prevalence: recovery.prevalence ?? null,
        entryIds: [],
        ...(recovery.maxScore !== undefined ? { maxScore: recovery.maxScore } : {}),
        reason: eligibility.reason,
      };
    } else {
      const scoped = entries.filter((e) => recovery.instrumentTypeIds.includes(e.instrumentTypeId));
      if (scoped.length === 0) {
        setPending(
          "elegivel-sem-registro",
          "Aluno elegível à recuperação final, sem nenhum registro lançado. Nenhum valor é presumido.",
        );
        pendencies.push({
          code: "recuperacao-final-elegivel-sem-registro",
          severity: "aviso",
          message:
            "Aluno elegível à recuperação final e sem registro lançado: o resultado pós-recuperação permanece em aberto.",
          pendingRuleIds: ["pn-recuperacao"],
        });
      } else {
        const outcome = applyRecovery({
          recovery,
          model,
          point,
          original: cycleStage,
          entries: scoped,
        });
        if (!outcome.applied || !outcome.recovery || !outcome.afterRecovery) {
          setPending("pendente-de-definicao", outcome.reason);
          pendencies.push({
            code: "recuperacao-final-pendente-de-definicao",
            severity: "bloqueante",
            message: `${outcome.reason} O resultado pós-recuperação permanece bloqueado.`,
            pendingRuleIds: ["pn-recuperacao"],
          });
        } else {
          projection = {
            state: "aplicada",
            recoveryScore: outcome.recovery.value,
            prevalence: outcome.prevalence,
            entryIds: scoped.map((e) => e.entryId),
            ...(recovery.maxScore !== undefined ? { maxScore: recovery.maxScore } : {}),
            reason: outcome.reason,
          };
          post = { value: outcome.afterRecovery.value, rounded: outcome.afterRecovery.rounded };
        }
      }
    }
  }

  const official =
    model.normativeStatus === "homologado" &&
    cycle.periods.every((p) => p.official) &&
    contributions.every((c) => c.closed);

  return {
    ...base,
    kind: "consolidado",
    rawCycleScore: cycleStage.raw,
    cycleScore: cycleStage.value,
    cycleRounded: cycleStage.rounded,
    finalRecovery: projection,
    postRecoveryScore: post ? post.value : null,
    postRecoveryRounded: post ? post.rounded : false,
    academicStanding: null,
    official,
    facts: facts({ finalRecoveryState: projection.state, official }),
  };
}

// ------------------------------------------------------------------ Rótulos

/** Rótulo neutro. Nunca "aprovado", "reprovado", "retido" ou "final". */
export function cycleConsolidationHeadline(result: CycleConsolidation): string {
  switch (result.kind) {
    case "bloqueado":
      return "Consolidação bloqueada — governança normativa incompleta";
    case "nao-aplicavel":
      return "Consolidação numérica não aplicável a esta configuração";
    case "acumulado-parcial":
      return "Acumulado parcial — o ciclo avaliativo ainda não está completo";
    case "pendencia-administrativa":
      return "Consolidação aguardando decisão administrativa/pedagógica";
    case "consolidado":
      return result.official
        ? `${result.cycle.label} — resultado consolidado do ciclo`
        : `${result.cycle.label} — simulação não oficial`;
  }
}

/** Intervalo do ciclo, exibido separadamente do rótulo configurado. */
export const cycleDateRange = cycleRange;
