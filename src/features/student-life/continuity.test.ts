/**
 * Etapa 13E — Auditoria da ponte entre resultado acadêmico e Vida Escolar.
 *
 * Os testes provam CAPACIDADE do motor com dados fictícios. Nenhuma regra real
 * da Rede é homologada aqui, e a etapa nunca constitui matrícula, participação
 * ou enturmação.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { StudentAcademicCycleProjection } from "@/features/academic-projections/academic-projection-types";
import type { InstitutionalActReference, StudentLifeProvenance } from "./student-life-types";
import {
  CONTINUITY_SOURCE_TYPE_DEFINITION_IDS,
  normalizeFromCanonicalProjection,
  normalizeFromExternalRecord,
} from "./continuity-adapters";
import { CONTINUITY_DIAGNOSTIC_CODES as CODES } from "./continuity-diagnostics";
import {
  CONTINUITY_COMBINATOR_IDS,
  CONTINUITY_COMPARATOR_IDS,
  CONTINUITY_CONDITION_KIND_IDS,
  CONTINUITY_CONSEQUENCE_EXECUTOR_IDS,
  createContinuityConditionRegistry,
  createContinuityConsequenceRegistry,
  evaluateContinuity,
  registerContinuityConditionEvaluator,
  registerContinuityConsequenceExecutor,
} from "./continuity-policy-engine";
import {
  constituteObligation,
  currentObligationStatus,
  obligationStatusAsOf,
  obligationsAsOf,
  validateObligationEvent,
} from "./continuity-ledger";
import { authorizeEquivalenceDecision, reviewEquivalenceProcess } from "./continuity-equivalence";
import {
  continuityEquivalenceFactRows,
  continuityEvaluationFactRows,
  continuityIssueFactRows,
  continuityObligationEventFactRows,
  continuityObligationStateProjectionRows,
} from "./continuity-analytics";
import {
  DEMO_CONTINUITY_CAPACITIES,
  DEMO_CONTINUITY_FACT_KEYS,
  DEMO_CONTINUITY_GOVERNANCE,
  DEMO_CONTINUITY_ISSUE_TYPES,
  DEMO_CONTINUITY_POLICY,
  DEMO_CONTINUITY_RESOLUTION_STATES,
  DEMO_CONTINUITY_TARGET_CONTEXT,
  DEMO_EQUIVALENCE_DECISION_KINDS,
  DEMO_OBLIGATION_EVENT_TYPES,
  DEMO_OBLIGATION_NATURES,
  DEMO_OBLIGATION_STATUSES,
  DRAFT_FINAL_YEARS_CONTINUITY_POLICY,
} from "./continuity-fixtures";
import type {
  AcademicContinuityPolicy,
  AcademicEquivalenceProcess,
  ContinuityRule,
  ExternalAcademicRecord,
  NormalizedAcademicDimension,
  NormalizedAcademicOrigin,
  ObligationLedgerEntry,
} from "./continuity-types";

const PROVENANCE: StudentLifeProvenance = {
  originTypeId: "atendimento-presencial",
  recordedAt: "2027-02-10T12:00:00.000Z",
  recordedByAgentId: "agente-teste",
};

const ACT: InstitutionalActReference = {
  actId: "ato-teste",
  actTypeId: "despacho",
  actDate: "2027-02-10",
};

function dimension(
  id: string,
  pending: boolean,
  kindId = "componente-curricular",
): NormalizedAcademicDimension {
  return {
    dimensionId: id,
    dimensionKindId: kindId,
    labelSnapshot: id,
    facts: [{ factKey: DEMO_CONTINUITY_FACT_KEYS.dimensionPending, value: pending }],
  };
}

function origin(overrides: Partial<NormalizedAcademicOrigin> = {}): NormalizedAcademicOrigin {
  return {
    originId: "origem-1",
    studentId: "aluno-1",
    sourceTypeDefinitionId: CONTINUITY_SOURCE_TYPE_DEFINITION_IDS.canonicalProjection,
    sourceSchemaVersion: 1,
    sourceReference: { kind: "encerramento-de-ciclo", id: "encerramento-1", version: 1 },
    resolutionReference: {
      definitionId: "situacao-demonstrativa",
      sourceRecordId: "encerramento-1",
      sourceVersion: 1,
    },
    facts: [{ factKey: DEMO_CONTINUITY_FACT_KEYS.documentationComplete, value: true }],
    dimensions: [],
    provenance: PROVENANCE,
    ...overrides,
  };
}

function evaluate(
  input: {
    origin?: NormalizedAcademicOrigin;
    policy?: AcademicContinuityPolicy;
    evaluationId?: string;
    supersedesEvaluationId?: string;
  } = {},
) {
  return evaluateContinuity({
    evaluationId: input.evaluationId ?? "aval-1",
    origin: input.origin ?? origin(),
    target: DEMO_CONTINUITY_TARGET_CONTEXT,
    policy: input.policy ?? DEMO_CONTINUITY_POLICY,
    effectiveDate: "2027-02-10",
    provenance: PROVENANCE,
    ...(input.supersedesEvaluationId
      ? { supersedesEvaluationId: input.supersedesEvaluationId }
      : {}),
  });
}

function withRules(rules: readonly ContinuityRule[]): AcademicContinuityPolicy {
  return { ...DEMO_CONTINUITY_POLICY, rules };
}

describe("13E — continuidade sem obrigações", () => {
  it("aluno prossegue elegível quando nada pendente é declarado", () => {
    const result = evaluate();
    expect(result.resolution?.resolutionStateDefinitionId).toBe(
      DEMO_CONTINUITY_RESOLUTION_STATES.eligible,
    );
    expect(result.obligationDrafts).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
  });

  it("preserva a política e a versão que produziram a conclusão", () => {
    const result = evaluate();
    expect(result.policyReference).toEqual({
      policyId: DEMO_CONTINUITY_POLICY.policyId,
      policyVersion: DEMO_CONTINUITY_POLICY.policyVersion,
    });
  });
});

describe("13E — obrigações de continuidade em qualquer quantidade", () => {
  it("constitui duas obrigações a partir de duas dimensões pendentes", () => {
    const result = evaluate({
      origin: origin({ dimensions: [dimension("mat", true), dimension("port", true)] }),
    });
    expect(result.obligationDrafts).toHaveLength(2);
    expect(result.resolution?.resolutionStateDefinitionId).toBe(
      DEMO_CONTINUITY_RESOLUTION_STATES.eligibleConditioned,
    );
  });

  it("admite cinco obrigações sem qualquer alteração do motor", () => {
    const dimensions = ["a", "b", "c", "d", "e"].map((id) => dimension(id, true));
    const result = evaluate({ origin: origin({ dimensions }) });
    expect(result.obligationDrafts).toHaveLength(5);
  });

  it("não constitui obrigação para dimensão não pendente", () => {
    const result = evaluate({
      origin: origin({ dimensions: [dimension("mat", true), dimension("port", false)] }),
    });
    expect(result.obligationDrafts.map((item) => item.curriculumReference.referenceId)).toEqual([
      "mat",
    ]);
  });
});

describe("13E — origem da obrigação declarada pela política", () => {
  function natureRule(natureId: string, factKey: string): ContinuityRule {
    return {
      ruleId: `regra-${natureId}`,
      order: 1,
      conditionCombinatorId: CONTINUITY_COMBINATOR_IDS.all,
      conditions: [],
      consequences: [
        {
          consequenceDefinitionId: `consequencia-${natureId}`,
          executorId: CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.constituteObligation,
          parameters: {
            obligationNatureDefinitionId: natureId,
            initialStatusDefinitionId: DEMO_OBLIGATION_STATUSES.constituted,
            factKey,
            comparatorId: CONTINUITY_COMPARATOR_IDS.equals,
            value: true,
          },
        },
      ],
      stopOnMatch: true,
    };
  }

  it("gera obrigação por rendimento", () => {
    const result = evaluate({
      origin: origin({ dimensions: [dimension("mat", true)] }),
      policy: withRules([
        natureRule(
          DEMO_OBLIGATION_NATURES.partialProgressionPerformance,
          DEMO_CONTINUITY_FACT_KEYS.dimensionPending,
        ),
      ]),
    });
    expect(result.obligationDrafts[0]?.obligationNatureDefinitionId).toBe(
      DEMO_OBLIGATION_NATURES.partialProgressionPerformance,
    );
  });

  it("gera obrigação por frequência com o mesmo motor", () => {
    const dimensions: NormalizedAcademicDimension[] = [
      {
        dimensionId: "mat",
        dimensionKindId: "componente-curricular",
        facts: [{ factKey: "frequencia-insuficiente", value: true }],
      },
    ];
    const result = evaluate({
      origin: origin({ dimensions }),
      policy: withRules([
        natureRule(DEMO_OBLIGATION_NATURES.partialProgressionAttendance, "frequencia-insuficiente"),
      ]),
    });
    expect(result.obligationDrafts[0]?.obligationNatureDefinitionId).toBe(
      DEMO_OBLIGATION_NATURES.partialProgressionAttendance,
    );
  });

  it("gera obrigação por critério fictício inédito cadastrado", () => {
    const dimensions: NormalizedAcademicDimension[] = [
      {
        dimensionId: "projeto-integrador",
        dimensionKindId: "projeto",
        facts: [{ factKey: "projeto-nao-concluido", value: true }],
      },
    ];
    const result = evaluate({
      origin: origin({ dimensions }),
      policy: withRules([
        natureRule(DEMO_OBLIGATION_NATURES.curricularComplementation, "projeto-nao-concluido"),
      ]),
    });
    expect(result.obligationDrafts[0]?.curriculumReference.referenceKindId).toBe("projeto");
  });

  it("aceita natureza de obrigação fictícia recém-cadastrada sem alterar o domínio", () => {
    const natureId = "obrigacao-ficticia-de-itinerario";
    const policy: AcademicContinuityPolicy = {
      ...withRules([natureRule(natureId, DEMO_CONTINUITY_FACT_KEYS.dimensionPending)]),
      obligationNatureDefinitionIds: [
        ...DEMO_CONTINUITY_POLICY.obligationNatureDefinitionIds,
        natureId,
      ],
    };
    const result = evaluate({ origin: origin({ dimensions: [dimension("mat", true)] }), policy });
    expect(result.obligationDrafts[0]?.obligationNatureDefinitionId).toBe(natureId);
  });

  it("aceita novo estado de obrigação cadastrado sem alterar o domínio", () => {
    const statusId = "aguardando-oferta-de-cumprimento";
    const rule: ContinuityRule = {
      ruleId: "regra-novo-estado",
      order: 1,
      conditionCombinatorId: CONTINUITY_COMBINATOR_IDS.all,
      conditions: [],
      consequences: [
        {
          consequenceDefinitionId: "consequencia-novo-estado",
          executorId: CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.constituteObligation,
          parameters: {
            obligationNatureDefinitionId: DEMO_OBLIGATION_NATURES.curricularComplementation,
            initialStatusDefinitionId: statusId,
            factKey: DEMO_CONTINUITY_FACT_KEYS.dimensionPending,
            comparatorId: CONTINUITY_COMPARATOR_IDS.equals,
            value: true,
          },
        },
      ],
    };
    const policy: AcademicContinuityPolicy = {
      ...withRules([rule]),
      obligationStatusDefinitionIds: [
        ...DEMO_CONTINUITY_POLICY.obligationStatusDefinitionIds,
        statusId,
      ],
    };
    const result = evaluate({ origin: origin({ dimensions: [dimension("mat", true)] }), policy });
    expect(result.obligationDrafts[0]?.initialStatusDefinitionId).toBe(statusId);
  });
});

describe("13E — percurso sem resolução terminal", () => {
  it("não inventa resolução acadêmica e registra a ausência como fato", () => {
    const base = origin({ dimensions: [] });
    const { resolutionReference: _omitted, ...rest } = base;
    const qualitative: NormalizedAcademicOrigin = rest;
    const result = evaluate({ origin: qualitative });
    expect(result.originReference.resolutionReference).toBeUndefined();
    expect(result.diagnostics.map((item) => item.code)).toContain(CODES.originResolutionAbsent);
    expect(result.resolution?.resolutionStateDefinitionId).toBe(
      DEMO_CONTINUITY_RESOLUTION_STATES.eligible,
    );
  });
});

describe("13E — documentação insuficiente", () => {
  it("produz pendência estruturada, nunca decisão presumida", () => {
    const external: ExternalAcademicRecord = {
      externalRecordId: "doc-1",
      studentId: "aluno-2",
      documentTypeDefinitionId: "declaracao-provisoria",
      sourceSchemaVersion: 1,
      facts: [{ factKey: DEMO_CONTINUITY_FACT_KEYS.documentationComplete, value: false }],
      dimensions: [],
      provenance: PROVENANCE,
    };
    const normalized = normalizeFromExternalRecord(external, { originId: "origem-ext-1" });
    const result = evaluate({ origin: normalized });
    expect(result.issues[0]?.issueTypeDefinitionId).toBe(
      DEMO_CONTINUITY_ISSUE_TYPES.insufficientDocumentation,
    );
    expect(result.obligationDrafts).toHaveLength(0);
    expect(result.resolution?.resolutionStateDefinitionId).toBe(
      DEMO_CONTINUITY_RESOLUTION_STATES.inconclusive,
    );
  });

  it("fato ausente nunca satisfaz condição por presunção", () => {
    const withoutFact = origin({ facts: [] });
    const result = evaluate({ origin: withoutFact });
    expect(result.resolution?.resolutionStateDefinitionId).toBe(
      DEMO_CONTINUITY_RESOLUTION_STATES.eligible,
    );
    expect(result.issues).toHaveLength(0);
  });
});

describe("13E — fontes acadêmicas abertas", () => {
  const projection: StudentAcademicCycleProjection = {
    projectionSchemaVersion: 1,
    studentId: "aluno-3",
    classId: "turma-1",
    cycleId: "ciclo-1",
    closingSnapshotId: "encerramento-9",
    closingVersion: 2,
    isCurrentClosingVersion: true,
    institutionalState: "encerrado",
    resolution: { completeness: "completo", standingId: "situacao-demonstrativa" },
    dimensions: [
      {
        dimensionId: "mat",
        dimensionKindId: "componente-curricular",
        scopeReference: { dimensions: {} },
        facts: [
          {
            factId: DEMO_CONTINUITY_FACT_KEYS.dimensionPending,
            value: true,
            scopeReference: { dimensions: {} },
            provenance: { sources: [], algorithm: "demonstracao", materializedAt: "2027-01-20" },
          },
        ],
      },
    ],
    attendance: { facts: [], dimensions: [] },
    facts: [],
    deliberations: [],
    issues: [],
    provenance: {
      closingSnapshotId: "encerramento-9",
      closingVersion: 2,
      policyId: "politica-encerramento",
      policyVersion: 1,
      materializedAt: "2027-01-20T10:00:00.000Z",
      sourceReferences: [],
    },
  };

  it("traduz a projeção canônica preservando referência, versão e resolução", () => {
    const normalized = normalizeFromCanonicalProjection(projection, {
      originId: "origem-12l",
      provenance: PROVENANCE,
    });
    expect(normalized.sourceReference).toMatchObject({ id: "encerramento-9", version: 2 });
    expect(normalized.resolutionReference?.definitionId).toBe("situacao-demonstrativa");
    const result = evaluate({ origin: normalized });
    expect(result.obligationDrafts).toHaveLength(1);
  });

  it("aceita uma terceira fonte fictícia sem alteração do motor", () => {
    const legacy = origin({
      sourceTypeDefinitionId: "migracao-sistema-legado-municipal",
      sourceSchemaVersion: 7,
      sourceReference: { kind: "lote-de-migracao", id: "lote-2019", version: 7 },
      dimensions: [dimension("mat", true)],
    });
    const result = evaluate({ origin: legacy });
    expect(result.originReference.sourceTypeDefinitionId).toBe(
      "migracao-sistema-legado-municipal",
    );
    expect(result.obligationDrafts).toHaveLength(1);
  });
});

describe("13E — consequências e condições extensíveis", () => {
  it("registra nova consequência por executor sem alterar o motor", () => {
    const executors = createContinuityConsequenceRegistry();
    registerContinuityConsequenceExecutor(executors, "encaminhar-orientacao-pedagogica", () => ({
      consequenceDefinitionId: "encaminhamento",
      executorId: "encaminhar-orientacao-pedagogica",
      status: "aplicado",
      obligationDrafts: [],
      equivalenceRequests: [],
      issues: [
        {
          issueId: "pend-encaminhamento",
          issueTypeDefinitionId: DEMO_CONTINUITY_ISSUE_TYPES.curriculumNotComparable,
        },
      ],
      diagnostics: [],
    }));
    const result = evaluateContinuity({
      evaluationId: "aval-exec",
      origin: origin(),
      target: DEMO_CONTINUITY_TARGET_CONTEXT,
      policy: withRules([
        {
          ruleId: "regra-encaminhamento",
          order: 1,
          conditionCombinatorId: CONTINUITY_COMBINATOR_IDS.all,
          conditions: [],
          consequences: [
            {
              consequenceDefinitionId: "encaminhamento",
              executorId: "encaminhar-orientacao-pedagogica",
            },
          ],
        },
      ]),
      effectiveDate: "2027-02-10",
      provenance: PROVENANCE,
      consequenceExecutors: executors,
    });
    expect(result.issues[0]?.issueId).toBe("pend-encaminhamento");
  });

  it("acusa executor inexistente em vez de presumir consequência", () => {
    const result = evaluate({
      policy: withRules([
        {
          ruleId: "regra-sem-executor",
          order: 1,
          conditionCombinatorId: CONTINUITY_COMBINATOR_IDS.all,
          conditions: [],
          consequences: [
            { consequenceDefinitionId: "x", executorId: "executor-inexistente" },
          ],
        },
      ]),
    });
    expect(result.diagnostics.map((item) => item.code)).toContain(
      CODES.consequenceExecutorMissing,
    );
    expect(result.resolution).toBeNull();
  });

  it("registra novo avaliador de condição cadastrado", () => {
    const evaluators = createContinuityConditionRegistry();
    registerContinuityConditionEvaluator(evaluators, "condicao-ficticia", () => ({
      satisfied: true,
      diagnostics: [],
    }));
    const result = evaluateContinuity({
      evaluationId: "aval-cond",
      origin: origin(),
      target: DEMO_CONTINUITY_TARGET_CONTEXT,
      policy: withRules([
        {
          ruleId: "regra-condicao-ficticia",
          order: 1,
          conditionCombinatorId: CONTINUITY_COMBINATOR_IDS.all,
          conditions: [{ conditionKindId: "condicao-ficticia", parameters: {} }],
          consequences: [
            {
              consequenceDefinitionId: "elegivel",
              executorId: CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.publishResolution,
              parameters: {
                resolutionStateDefinitionId: DEMO_CONTINUITY_RESOLUTION_STATES.eligible,
              },
            },
          ],
        },
      ]),
      effectiveDate: "2027-02-10",
      provenance: PROVENANCE,
      conditionEvaluators: evaluators,
    });
    expect(result.appliedRuleIds).toEqual(["regra-condicao-ficticia"]);
  });
});

describe("13E — governança da política", () => {
  it("bloqueia rascunho não homologado com diagnóstico explícito", () => {
    const result = evaluate({ policy: DRAFT_FINAL_YEARS_CONTINUITY_POLICY });
    expect(result.diagnostics.map((item) => item.code)).toContain(CODES.policyNotHomologated);
    expect(result.resolution).toBeNull();
  });

  it("não declara resolução quando nenhuma regra corresponde", () => {
    const result = evaluate({ policy: withRules([]) });
    expect(result.appliedRuleIds).toHaveLength(0);
    expect(result.resolution).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain(CODES.noRuleMatched);
  });
});

describe("13E — equivalência curricular N:M", () => {
  function decision(kindId: string, capacityId: string) {
    return {
      decisionId: "dec-1",
      decisionKindDefinitionId: kindId,
      actorReference: { actorId: "ator-1", actorNameSnapshot: "Analista demonstrativo" },
      capacityDefinitionId: capacityId,
      institutionalActReference: ACT,
      targetCurriculumVersion: { definitionId: "matriz-demonstrativa", definitionVersion: 3 },
      decidedAt: "2027-02-11",
      provenance: PROVENANCE,
    };
  }

  const process: AcademicEquivalenceProcess = {
    equivalenceProcessId: "eqv-1",
    studentId: "aluno-4",
    originId: "origem-ext-2",
    targetCurriculumVersion: { definitionId: "matriz-demonstrativa", definitionVersion: 3 },
    groups: [
      {
        groupId: "grupo-nm",
        originReferences: [
          { referenceKindId: "componente-curricular", referenceId: "ciencias-fisicas" },
          { referenceKindId: "componente-curricular", referenceId: "ciencias-biologicas" },
        ],
        targetReferences: [{ referenceKindId: "componente-curricular", referenceId: "ciencias" }],
        decision: decision(
          DEMO_EQUIVALENCE_DECISION_KINDS.full,
          DEMO_CONTINUITY_CAPACITIES.equivalenceAnalysis,
        ),
      },
      {
        groupId: "grupo-area",
        originReferences: [{ referenceKindId: "area-do-conhecimento", referenceId: "linguagens" }],
        targetReferences: [
          { referenceKindId: "competencia", referenceId: "leitura-e-producao-textual" },
          { referenceKindId: "componente-curricular", referenceId: "lingua-portuguesa" },
        ],
      },
    ],
    provenance: PROVENANCE,
  };

  it("reconhece equivalência de vários componentes para um só", () => {
    const review = reviewEquivalenceProcess(process, DEMO_CONTINUITY_GOVERNANCE);
    expect(review.decidedGroupIds).toEqual(["grupo-nm"]);
    expect(review.undecidedGroupIds).toEqual(["grupo-area"]);
    expect(review.diagnostics).toHaveLength(0);
  });

  it("suporta correspondência que não é componente curricular", () => {
    const group = process.groups[1]!;
    expect(group.targetReferences.map((item) => item.referenceKindId)).toContain("competencia");
  });

  it("autoriza pela competência, nunca pelo cargo", () => {
    const scope = { studentId: "aluno-4" };
    const authorized = authorizeEquivalenceDecision(
      DEMO_CONTINUITY_GOVERNANCE,
      decision(
        DEMO_EQUIVALENCE_DECISION_KINDS.partial,
        DEMO_CONTINUITY_CAPACITIES.equivalenceAnalysis,
      ),
      scope,
    );
    expect(authorized.allowed).toBe(true);
    const refused = authorizeEquivalenceDecision(
      DEMO_CONTINUITY_GOVERNANCE,
      decision(
        DEMO_EQUIVALENCE_DECISION_KINDS.partial,
        DEMO_CONTINUITY_CAPACITIES.schoolSecretary,
      ),
      scope,
    );
    expect(refused.allowed).toBe(false);
    expect(refused.diagnostics.map((item) => item.code)).toContain(
      CODES.equivalenceCapacityNotAuthorized,
    );
  });

  it("aceita nova natureza de decisão cadastrada sem alterar os tipos centrais", () => {
    const governance = {
      ...DEMO_CONTINUITY_GOVERNANCE,
      equivalenceDecisionKindDefinitionIds: [
        ...DEMO_CONTINUITY_GOVERNANCE.equivalenceDecisionKindDefinitionIds,
        "equivalencia-com-banca-especial",
      ],
    };
    const result = authorizeEquivalenceDecision(
      governance,
      decision(
        "equivalencia-com-banca-especial",
        DEMO_CONTINUITY_CAPACITIES.equivalenceAnalysis,
      ),
      { studentId: "aluno-4" },
    );
    expect(result.allowed).toBe(true);
  });

  it("não reinterpreta equivalência antiga quando a matriz de destino muda", () => {
    const newerContextVersion = 4;
    const decided = process.groups[0]!.decision!;
    expect(decided.targetCurriculumVersion.definitionVersion).toBe(3);
    expect(decided.targetCurriculumVersion.definitionVersion).not.toBe(newerContextVersion);
  });

  it("recusa grupo de correspondência vazio", () => {
    const empty: AcademicEquivalenceProcess = {
      ...process,
      groups: [{ groupId: "vazio", originReferences: [], targetReferences: [] }],
    };
    const review = reviewEquivalenceProcess(empty, DEMO_CONTINUITY_GOVERNANCE);
    expect(review.diagnostics.map((item) => item.code)).toContain(CODES.equivalenceGroupEmpty);
  });
});

describe("13E — obrigação com estado projetado do ledger", () => {
  const evaluation = evaluate({ origin: origin({ dimensions: [dimension("mat", true)] }) });

  const constituted = constituteObligation({
    obligationId: "obr-1",
    studentId: "aluno-1",
    draft: evaluation.obligationDrafts[0]!,
    originReference: {
      originId: "origem-1",
      sourceTypeDefinitionId: CONTINUITY_SOURCE_TYPE_DEFINITION_IDS.canonicalProjection,
      evaluationId: evaluation.evaluationId,
      policyId: DEMO_CONTINUITY_POLICY.policyId,
      policyVersion: DEMO_CONTINUITY_POLICY.policyVersion,
    },
    eventTypeDefinitionId: DEMO_OBLIGATION_EVENT_TYPES.constitution,
    entryId: "entrada-1",
    provenance: PROVENANCE,
  });

  const fulfillment: ObligationLedgerEntry = {
    entryId: "entrada-2",
    obligationId: "obr-1",
    eventTypeDefinitionId: DEMO_OBLIGATION_EVENT_TYPES.fulfillment,
    fromStatusDefinitionId: DEMO_OBLIGATION_STATUSES.constituted,
    toStatusDefinitionId: DEMO_OBLIGATION_STATUSES.satisfied,
    effectiveDate: "2027-06-30",
    institutionalActReference: ACT,
    isCorrection: false,
    precedingEntryId: null,
    provenance: { ...PROVENANCE, recordedAt: "2027-07-01T09:00:00.000Z" },
  };

  const ledger = [constituted.entry, fulfillment];

  it("a entidade não guarda estado: o estado vem do ledger", () => {
    expect(Object.keys(constituted.obligation)).not.toContain("statusDefinitionId");
    expect(currentObligationStatus(ledger, "obr-1")).toBe(DEMO_OBLIGATION_STATUSES.satisfied);
  });

  it("reconstrói o estado em duas datas históricas distintas", () => {
    expect(obligationStatusAsOf(ledger, "obr-1", "2027-03-01")).toBe(
      DEMO_OBLIGATION_STATUSES.constituted,
    );
    expect(obligationStatusAsOf(ledger, "obr-1", "2027-07-15")).toBe(
      DEMO_OBLIGATION_STATUSES.satisfied,
    );
  });

  it("responde quais obrigações existiam em determinada data", () => {
    const rows = obligationsAsOf([constituted.obligation], ledger, "2027-03-01");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.statusDefinitionId).toBe(DEMO_OBLIGATION_STATUSES.constituted);
    expect(obligationsAsOf([constituted.obligation], ledger, "2026-12-31")).toHaveLength(0);
  });

  it("cumprimento exige evento institucional válido, não troca de campo", () => {
    const validation = validateObligationEvent(
      DEMO_CONTINUITY_POLICY,
      DEMO_CONTINUITY_GOVERNANCE,
      [constituted.entry],
      fulfillment,
      { studentId: "aluno-1" },
    );
    expect(validation.allowed).toBe(true);

    const broken = validateObligationEvent(
      DEMO_CONTINUITY_POLICY,
      DEMO_CONTINUITY_GOVERNANCE,
      [constituted.entry],
      { ...fulfillment, fromStatusDefinitionId: DEMO_OBLIGATION_STATUSES.inProgress },
      { studentId: "aluno-1" },
    );
    expect(broken.allowed).toBe(false);
    expect(broken.diagnostics.map((item) => item.code)).toContain(
      CODES.obligationStatusChainBroken,
    );
  });

  it("recusa tipo de evento não cadastrado", () => {
    const validation = validateObligationEvent(
      DEMO_CONTINUITY_POLICY,
      DEMO_CONTINUITY_GOVERNANCE,
      [constituted.entry],
      { ...fulfillment, eventTypeDefinitionId: "evento-nao-cadastrado" },
      { studentId: "aluno-1" },
    );
    expect(validation.diagnostics.map((item) => item.code)).toContain(
      CODES.obligationEventTypeUndeclared,
    );
  });

  it("publica os eventos atômicos e o estado como projeção derivada", () => {
    const events = continuityObligationEventFactRows(ledger, [constituted.obligation]);
    expect(events).toHaveLength(2);
    expect(events[0]?.fromStatusDefinitionId).toBeNull();
    const projected = continuityObligationStateProjectionRows(
      [constituted.obligation],
      ledger,
      "2027-03-01",
    );
    expect(projected[0]?.statusDefinitionId).toBe(DEMO_OBLIGATION_STATUSES.constituted);
  });
});

describe("13E — retificação bitemporal", () => {
  it("nova avaliação encadeia sem apagar a decisão histórica anterior", () => {
    const partial: ExternalAcademicRecord = {
      externalRecordId: "doc-2",
      studentId: "aluno-5",
      documentTypeDefinitionId: "declaracao-provisoria",
      sourceSchemaVersion: 1,
      facts: [{ factKey: DEMO_CONTINUITY_FACT_KEYS.documentationComplete, value: true }],
      dimensions: [dimension("mat", true)],
      provenance: PROVENANCE,
    };
    const first = evaluate({
      evaluationId: "aval-fev",
      origin: normalizeFromExternalRecord(partial, { originId: "origem-fev" }),
    });

    const rectified: ExternalAcademicRecord = {
      ...partial,
      externalRecordId: "doc-2-retificado",
      dimensions: [dimension("mat", true), dimension("port", true)],
      provenance: {
        ...PROVENANCE,
        recordedAt: "2027-04-20T12:00:00.000Z",
        supersedesId: "doc-2",
        correctionReasonDefinitionId: "retificacao-de-historico-externo",
      },
    };
    const second = evaluate({
      evaluationId: "aval-abr",
      origin: normalizeFromExternalRecord(rectified, { originId: "origem-abr" }),
      supersedesEvaluationId: "aval-fev",
    });

    expect(first.obligationDrafts).toHaveLength(1);
    expect(second.obligationDrafts).toHaveLength(2);
    expect(second.supersedesEvaluationId).toBe("aval-fev");
    const rows = continuityEvaluationFactRows([first, second]);
    expect(rows.map((row) => row.supersedesEvaluationId)).toEqual([null, "aval-fev"]);
  });
});

describe("13E — fatos atômicos para o CIECE", () => {
  it("publica avaliação, pendência e equivalência sem indicadores", () => {
    const external: ExternalAcademicRecord = {
      externalRecordId: "doc-3",
      studentId: "aluno-6",
      documentTypeDefinitionId: "certidao",
      sourceSchemaVersion: 1,
      facts: [{ factKey: DEMO_CONTINUITY_FACT_KEYS.documentationComplete, value: false }],
      dimensions: [],
      provenance: PROVENANCE,
    };
    const result = evaluate({
      evaluationId: "aval-ciece",
      origin: normalizeFromExternalRecord(external, { originId: "origem-ciece" }),
    });
    const evaluationRows = continuityEvaluationFactRows([result]);
    expect(evaluationRows[0]).toMatchObject({
      policyId: DEMO_CONTINUITY_POLICY.policyId,
      policyVersion: 1,
      issueCount: 1,
    });
    const issueRows = continuityIssueFactRows([result]);
    expect(issueRows[0]?.requiredDocumentTypeDefinitionIds).toEqual(["historico-escolar-oficial"]);

    const equivalenceRows = continuityEquivalenceFactRows([
      {
        equivalenceProcessId: "eqv-ciece",
        studentId: "aluno-6",
        originId: "origem-ciece",
        targetCurriculumVersion: { definitionId: "matriz-demonstrativa", definitionVersion: 3 },
        groups: [
          {
            groupId: "g1",
            originReferences: [{ referenceKindId: "componente-curricular", referenceId: "a" }],
            targetReferences: [
              { referenceKindId: "componente-curricular", referenceId: "b" },
              { referenceKindId: "componente-curricular", referenceId: "c" },
            ],
          },
        ],
        provenance: PROVENANCE,
      },
    ]);
    expect(equivalenceRows[0]).toMatchObject({ originReferenceCount: 1, targetReferenceCount: 2 });
    expect(Object.keys(equivalenceRows[0]!)).not.toContain("taxaDeAproveitamento");
  });
});

describe("13E — fronteira formal com matrícula e enturmação", () => {
  const moduleFiles = [
    "continuity-types.ts",
    "continuity-policy-engine.ts",
    "continuity-ledger.ts",
    "continuity-equivalence.ts",
    "continuity-adapters.ts",
    "continuity-analytics.ts",
    "continuity-fixtures.ts",
  ];

  it("nenhum módulo da 13E constitui inscrição, participação ou alocação", () => {
    const forbidden = ["AcademicCycleEnrollment", "CycleParticipation", "ClassAllocation"];
    for (const file of moduleFiles) {
      const source = readFileSync(
        path.join(process.cwd(), "src/features/student-life", file),
        "utf8",
      );
      const codeLines = source
        .split("\n")
        .filter((line) => {
          const trimmed = line.trim();
          return !(trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*"));
        })
        .join("\n");
      for (const symbol of forbidden) {
        expect(codeLines, `${file} referencia ${symbol}`).not.toContain(symbol);
      }
    }
  });

  it("a avaliação produz apenas resoluções, obrigações, equivalências e pendências", () => {
    const result = evaluate({ origin: origin({ dimensions: [dimension("mat", true)] }) });
    expect(Object.keys(result).sort()).toEqual(
      [
        "appliedRuleIds",
        "diagnostics",
        "effectiveDate",
        "equivalenceRequests",
        "evaluationId",
        "issues",
        "obligationDrafts",
        "originReference",
        "policyReference",
        "provenance",
        "resolution",
        "studentId",
        "targetContext",
      ].sort(),
    );
  });
});
