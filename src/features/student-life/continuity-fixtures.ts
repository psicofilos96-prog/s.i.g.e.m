/**
 * Etapa 13E — Configuração DEMONSTRATIVA da continuidade do percurso.
 *
 * NADA aqui é norma da Rede. São identificadores abertos e políticas de
 * demonstração que exercitam as capacidades do motor. A política real de
 * continuidade só existirá quando a Supervisão configurar e homologar.
 */
import type { StudentLifeProvenance } from "./student-life-types";
import {
  CONTINUITY_COMBINATOR_IDS,
  CONTINUITY_COMPARATOR_IDS,
  CONTINUITY_CONDITION_KIND_IDS,
  CONTINUITY_CONSEQUENCE_EXECUTOR_IDS,
} from "./continuity-policy-engine";
import { CONTINUITY_ACT_KIND_IDS } from "./continuity-diagnostics";
import type {
  AcademicContinuityPolicy,
  ContinuityGovernanceConfiguration,
  ContinuityTargetContext,
} from "./continuity-types";

const DEMO_PROVENANCE: StudentLifeProvenance = {
  originTypeId: "configuracao-demonstrativa",
  recordedAt: "2027-01-15T10:00:00.000Z",
  recordedByAgentId: "agente-demonstracao",
};

/** Estados de resolução de continuidade (abertos, cadastráveis). */
export const DEMO_CONTINUITY_RESOLUTION_STATES = {
  eligible: "elegivel-para-continuidade",
  eligibleConditioned: "elegivel-condicionado",
  requiresEquivalence: "requer-analise-de-equivalencia",
  inconclusive: "inconclusivo",
  notEligible: "nao-elegivel-segundo-a-politica",
} as const;

/** Naturezas de obrigação (abertas): "dependência" é apenas uma delas. */
export const DEMO_OBLIGATION_NATURES = {
  partialProgressionPerformance: "progressao-parcial-por-rendimento",
  partialProgressionAttendance: "progressao-parcial-por-frequencia",
  curricularComplementation: "complementacao-curricular",
} as const;

export const DEMO_OBLIGATION_STATUSES = {
  constituted: "constituida",
  inProgress: "em-cumprimento",
  satisfied: "satisfeita",
  waived: "dispensada-por-deliberacao",
  closed: "encerrada",
} as const;

export const DEMO_OBLIGATION_EVENT_TYPES = {
  constitution: "constituicao-de-obrigacao",
  start: "inicio-de-cumprimento",
  fulfillment: "cumprimento-de-obrigacao",
  waiver: "dispensa-de-obrigacao",
  closure: "encerramento-de-obrigacao",
} as const;

export const DEMO_CONTINUITY_ISSUE_TYPES = {
  insufficientDocumentation: "documentacao-academica-insuficiente",
  curriculumNotComparable: "estrutura-curricular-nao-comparavel",
} as const;

export const DEMO_EQUIVALENCE_DECISION_KINDS = {
  full: "equivalencia-integral",
  partial: "equivalencia-parcial-com-complementacao",
  none: "inequivalencia",
  adaptation: "estudos-de-adaptacao",
} as const;

export const DEMO_CONTINUITY_CAPACITIES = {
  equivalenceAnalysis: "competencia-analise-de-equivalencia",
  schoolSecretary: "competencia-secretaria-escolar",
} as const;

export const DEMO_CONTINUITY_GOVERNANCE: ContinuityGovernanceConfiguration = {
  configurationId: "governanca-continuidade-demonstrativa",
  configurationVersion: 1,
  capacities: [
    {
      capacityDefinitionId: DEMO_CONTINUITY_CAPACITIES.equivalenceAnalysis,
      labelSnapshot: "Competência para decidir equivalência curricular",
      authorizedActKindIds: [
        CONTINUITY_ACT_KIND_IDS.equivalenceDecision,
        CONTINUITY_ACT_KIND_IDS.obligationStatusChange,
      ],
    },
    {
      capacityDefinitionId: DEMO_CONTINUITY_CAPACITIES.schoolSecretary,
      labelSnapshot: "Competência de registro da Secretaria Escolar",
      authorizedActKindIds: [CONTINUITY_ACT_KIND_IDS.obligationStatusChange],
    },
  ],
  equivalenceDecisionKindDefinitionIds: Object.values(DEMO_EQUIVALENCE_DECISION_KINDS),
  obligationEventTypeDefinitionIds: Object.values(DEMO_OBLIGATION_EVENT_TYPES),
  provenance: DEMO_PROVENANCE,
};

/** Chaves de fato usadas pelas demonstrações; abertas e sem valor normativo. */
export const DEMO_CONTINUITY_FACT_KEYS = {
  dimensionResult: "resultado-da-dimensao",
  dimensionAttendance: "frequencia-da-dimensao",
  dimensionPending: "dimensao-pendente",
  documentationComplete: "documentacao-completa",
} as const;

const catalogs = {
  resolutionStateDefinitionIds: Object.values(DEMO_CONTINUITY_RESOLUTION_STATES),
  obligationStatusDefinitionIds: Object.values(DEMO_OBLIGATION_STATUSES),
  obligationNatureDefinitionIds: Object.values(DEMO_OBLIGATION_NATURES),
  issueTypeDefinitionIds: Object.values(DEMO_CONTINUITY_ISSUE_TYPES),
};

/**
 * Política DEMONSTRATIVA (fictícia) já homologada apenas para exercitar o
 * motor em tela e em teste. Não representa regra da Rede.
 */
export const DEMO_CONTINUITY_POLICY: AcademicContinuityPolicy = {
  policyId: "politica-continuidade-demonstrativa",
  policyVersion: 1,
  labelSnapshot: "Continuidade — demonstração fictícia",
  validFrom: "2027-01-01",
  validUntil: null,
  homologated: true,
  ...catalogs,
  rules: [
    {
      ruleId: "regra-pendencia-documental",
      order: 10,
      labelSnapshot: "Documentação externa insuficiente produz pendência",
      conditionCombinatorId: CONTINUITY_COMBINATOR_IDS.all,
      conditions: [
        {
          conditionKindId: CONTINUITY_CONDITION_KIND_IDS.fact,
          parameters: {
            factKey: `fato.${DEMO_CONTINUITY_FACT_KEYS.documentationComplete}`,
            comparatorId: CONTINUITY_COMPARATOR_IDS.equals,
            value: false,
          },
        },
      ],
      consequences: [
        {
          consequenceDefinitionId: "pendencia-documental",
          executorId: CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.registerIssue,
          parameters: {
            issueTypeDefinitionId: DEMO_CONTINUITY_ISSUE_TYPES.insufficientDocumentation,
            requiredDocumentTypeDefinitionIds: "historico-escolar-oficial",
            responsibleCapacityDefinitionId: DEMO_CONTINUITY_CAPACITIES.schoolSecretary,
          },
        },
        {
          consequenceDefinitionId: "resolucao-inconclusiva",
          executorId: CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.publishResolution,
          parameters: {
            resolutionStateDefinitionId: DEMO_CONTINUITY_RESOLUTION_STATES.inconclusive,
          },
        },
      ],
      stopOnMatch: true,
    },
    {
      ruleId: "regra-continuidade-com-obrigacoes",
      order: 20,
      labelSnapshot: "Dimensões pendentes constituem obrigações de continuidade",
      conditionCombinatorId: CONTINUITY_COMBINATOR_IDS.all,
      conditions: [
        {
          conditionKindId: CONTINUITY_CONDITION_KIND_IDS.dimensionCount,
          parameters: {
            factKey: DEMO_CONTINUITY_FACT_KEYS.dimensionPending,
            comparatorId: CONTINUITY_COMPARATOR_IDS.equals,
            value: true,
            countComparatorId: CONTINUITY_COMPARATOR_IDS.greaterOrEqual,
            countValue: 1,
          },
        },
      ],
      consequences: [
        {
          consequenceDefinitionId: "obrigacao-por-dimensao-pendente",
          executorId: CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.constituteObligation,
          parameters: {
            obligationNatureDefinitionId:
              DEMO_OBLIGATION_NATURES.partialProgressionPerformance,
            initialStatusDefinitionId: DEMO_OBLIGATION_STATUSES.constituted,
            factKey: DEMO_CONTINUITY_FACT_KEYS.dimensionPending,
            comparatorId: CONTINUITY_COMPARATOR_IDS.equals,
            value: true,
          },
        },
        {
          consequenceDefinitionId: "elegivel-condicionado",
          executorId: CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.publishResolution,
          parameters: {
            resolutionStateDefinitionId: DEMO_CONTINUITY_RESOLUTION_STATES.eligibleConditioned,
          },
        },
      ],
      stopOnMatch: true,
    },
    {
      ruleId: "regra-continuidade-simples",
      order: 30,
      labelSnapshot: "Percurso sem pendências segue elegível",
      conditionCombinatorId: CONTINUITY_COMBINATOR_IDS.all,
      conditions: [],
      consequences: [
        {
          consequenceDefinitionId: "elegivel",
          executorId: CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.publishResolution,
          parameters: {
            resolutionStateDefinitionId: DEMO_CONTINUITY_RESOLUTION_STATES.eligible,
          },
        },
      ],
      stopOnMatch: true,
    },
  ],
  provenance: DEMO_PROVENANCE,
};

/**
 * RASCUNHO institucional não homologado: espaço para a Supervisão registrar a
 * futura política de continuidade dos Anos Finais. Nenhum valor é norma.
 */
export const DRAFT_FINAL_YEARS_CONTINUITY_POLICY: AcademicContinuityPolicy = {
  policyId: "rascunho-continuidade-anos-finais",
  policyVersion: 1,
  labelSnapshot: "Continuidade — Anos Finais (rascunho não homologado)",
  validFrom: "2027-01-01",
  validUntil: null,
  homologated: false,
  ...catalogs,
  rules: [],
  provenance: DEMO_PROVENANCE,
};

export const DEMO_CONTINUITY_TARGET_CONTEXT: ContinuityTargetContext = {
  targetContextId: "contexto-demonstrativo-destino",
  attributes: {
    unidade: "unidade-demonstrativa",
    oferta: "oferta-demonstrativa",
    organizacaoAcademica: "organizacao-demonstrativa",
  },
  targetCurriculumReference: {
    definitionId: "matriz-demonstrativa",
    definitionVersion: 3,
    labelSnapshot: "Matriz curricular demonstrativa",
  },
};
