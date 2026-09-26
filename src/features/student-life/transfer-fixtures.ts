/**
 * Etapa 13D — Fixtures DEMONSTRATIVAS da Mobilidade Institucional.
 *
 * Tudo aqui é DEMONSTRAÇÃO, nunca norma: estágios, ritos, motivos, efeitos,
 * estados documentais, naturezas de intervalo, tipos de contexto e políticas são
 * dados cadastrados. Nada está homologado.
 *
 * Em especial: `intervalo-transito-regulamentar-demo` é FIXTURE. O motor não
 * conhece esse nome, não presume sua duração e não lhe atribui consequência.
 */
import type { EventPayloadSchemaDefinition } from "./student-life-types";
import type {
  InstitutionalTransferGovernanceConfiguration,
  SchoolBondEffectPolicy,
  StudentLifeSituationProjectionPolicy,
  TransferParticipationEffectPolicy,
} from "./transfer-types";
import { TRANSFER_EFFECT_EXECUTOR_IDS } from "./transfer-effects";
import { TRANSFER_FACT_KEYS, TRANSFER_REQUIREMENT_EVALUATOR_IDS } from "./transfer-governance";

// -------------------------------------------------- Identificadores demonstrativos

export const DEMO_TRANSFER_PROCESS_KINDS = {
  betweenNetworkUnits: "rito-mobilidade-entre-unidades-demo",
  networkExit: "rito-saida-da-rede-demo",
  networkEntry: "rito-ingresso-na-rede-demo",
} as const;

export const DEMO_TRANSFER_STAGES = {
  requested: "estagio-solicitado-demo",
  underReview: "estagio-em-analise-demo",
  departureRecorded: "estagio-saida-registrada-demo",
  welcomed: "estagio-acolhido-demo",
  cancelled: "estagio-cancelado-demo",
} as const;

export const DEMO_TRANSFER_TRANSITIONS = {
  open: "transicao-abertura-demo",
  review: "transicao-analise-demo",
  recordDeparture: "transicao-registrar-saida-demo",
  welcome: "transicao-acolher-demo",
  cancel: "transicao-cancelar-demo",
} as const;

export const DEMO_TRANSFER_REASONS = {
  addressChange: "motivo-mudanca-de-domicilio-demo",
  familyRequest: "motivo-solicitacao-da-familia-demo",
  administrative: "motivo-decisao-administrativa-demo",
  withdrawal: "motivo-desistencia-do-pedido-demo",
} as const;

export const DEMO_TRANSFER_CONTEXT_TYPES = {
  networkUnit: "ref-contexto-unidade-da-rede-demo",
  externalInstitution: "ref-contexto-instituicao-externa-demo",
} as const;

export const DEMO_TRANSFER_CONTEXT_SCHEMAS = {
  networkUnit: "schema-contexto-unidade-da-rede-demo",
  externalInstitution: "schema-contexto-instituicao-externa-demo",
} as const;

export const DEMO_TRANSFER_DOCUMENT_TYPES = {
  transferGuide: "doc-tipo-guia-de-transferencia-demo",
  attendanceDeclaration: "doc-tipo-declaracao-de-comparecimento-demo",
} as const;

export const DEMO_TRANSFER_DOCUMENT_STATUSES = {
  pending: "doc-estado-pendente-demo",
  issued: "doc-estado-emitido-demo",
  received: "doc-estado-recebido-demo",
  waived: "doc-estado-dispensado-demo",
} as const;

export const DEMO_TRANSFER_VERIFICATION_STATUSES = {
  pending: "verif-estado-conferencia-pendente-demo",
  confirmed: "verif-estado-conferido-demo",
} as const;

export const DEMO_TRANSITION_INTERVAL_KINDS = {
  regulatoryTransit: "intervalo-transito-regulamentar-demo",
  awaitingWelcome: "intervalo-aguardando-acolhimento-demo",
} as const;

export const DEMO_TRANSFER_EFFECTS = {
  closeAllocations: "efeito-encerrar-alocacoes-da-origem-demo",
  resolveParticipations: "efeito-resolver-participacoes-demo",
  evaluateBond: "efeito-avaliar-vinculo-demo",
  closeEnrollment: "efeito-encerrar-inscricao-demo",
  recordInterval: "efeito-registrar-intervalo-demo",
  publishMobility: "efeito-publicar-fato-de-mobilidade-demo",
  keepParticipation: "efeito-manter-participacao-demo",
  closeParticipation: "efeito-encerrar-participacao-demo",
  requireDeliberation: "efeito-exigir-deliberacao-demo",
  closeBond: "efeito-encerrar-vinculo-demo",
  keepBond: "efeito-manter-vinculo-demo",
} as const;

export const DEMO_TRANSFER_REQUIREMENT_EFFECTS = {
  prevents: "efeito-requisito-impede-demo",
  advisory: "efeito-requisito-registra-pendencia-demo",
} as const;

export const DEMO_MOBILITY_FACT_TYPES = {
  departureByTransfer: "fato-saida-por-transferencia-demo",
  entryByTransfer: "fato-ingresso-por-transferencia-demo",
} as const;

export const DEMO_TRANSFER_ABSENCE_REASONS = {
  notInformedByDeclarant: "motivo-destino-nao-informado-pelo-declarante-demo",
} as const;

export const DEMO_DECLARANT_ROLES = {
  legalGuardian: "papel-declarante-responsavel-legal-demo",
  student: "papel-declarante-estudante-demo",
  publicAgent: "papel-declarante-agente-publico-demo",
} as const;

export const DEMO_TRANSFER_SITUATIONS = {
  transferred: "sit-rede-transferido",
} as const;

// ------------------------------------------------------------- Schemas de polo

export const demonstrationTransferPayloadSchemas: EventPayloadSchemaDefinition[] = [
  {
    payloadSchemaDefinitionId: DEMO_TRANSFER_CONTEXT_SCHEMAS.networkUnit,
    fields: [
      { key: "schoolId", valueType: "string", required: true },
      { key: "schoolBondId", valueType: "string", required: false },
      { key: "cycleEnrollmentId", valueType: "string", required: false },
      { key: "academicCycleId", valueType: "string", required: false },
      { key: "educationalOfferId", valueType: "string", required: false },
      { key: "academicOrganizationId", valueType: "string", required: false },
    ],
  },
  {
    payloadSchemaDefinitionId: DEMO_TRANSFER_CONTEXT_SCHEMAS.externalInstitution,
    fields: [
      { key: "institutionName", valueType: "string", required: true },
      { key: "systemOrNetworkName", valueType: "string", required: false },
      { key: "federativeUnit", valueType: "string", required: false },
      { key: "municipality", valueType: "string", required: false },
      { key: "inepSchoolCode", valueType: "string", required: false },
    ],
  },
];

// ---------------------------------------------------------------- Políticas

/**
 * Política de efeito sobre participações. A conduta da escolarização principal
 * está declarada; participações complementares NÃO recebem conduta por omissão —
 * é a política, e não a 13D, que decide manter, encerrar ou exigir decisão.
 */
export const demonstrationParticipationEffectPolicy: TransferParticipationEffectPolicy = {
  policyId: "pol-efeito-participacoes-transferencia-demo",
  policyVersion: 1,
  rules: [
    {
      ruleId: "regra-escolarizacao-principal-demo",
      appliesToNatureDefinitionIds: ["nat-escolarizacao-principal"],
      effect: {
        effectDefinitionId: DEMO_TRANSFER_EFFECTS.closeParticipation,
        effectExecutorId: "exec-aplicar-efeito-sobre-participacao-demo",
      },
    },
  ],
};

/**
 * Política de efeito sobre o vínculo escolar. "Encerra quando não restam
 * inscrições vigentes" é REGRA CADASTRADA sobre um FATO publicado pelo motor.
 */
export const demonstrationSchoolBondEffectPolicy: SchoolBondEffectPolicy = {
  policyId: "pol-efeito-vinculo-transferencia-demo",
  policyVersion: 1,
  rules: [
    {
      ruleId: "regra-sem-inscricoes-remanescentes-demo",
      factKeyId: TRANSFER_FACT_KEYS.remainingEnrollmentsInBond,
      comparator: "eq",
      value: 0,
      effect: {
        effectDefinitionId: DEMO_TRANSFER_EFFECTS.closeBond,
        effectExecutorId: "exec-aplicar-efeito-sobre-vinculo-demo",
      },
    },
    {
      ruleId: "regra-com-inscricoes-remanescentes-demo",
      factKeyId: TRANSFER_FACT_KEYS.remainingEnrollmentsInBond,
      comparator: "gte",
      value: 1,
      effect: {
        effectDefinitionId: DEMO_TRANSFER_EFFECTS.keepBond,
        effectExecutorId: "exec-aplicar-efeito-sobre-vinculo-demo",
      },
    },
  ],
};

/** Política de projeção de situação de vida escolar — versão demonstrativa 1. */
export const demonstrationSituationProjectionPolicy: StudentLifeSituationProjectionPolicy = {
  policyId: "pol-projecao-situacao-vida-escolar-demo",
  policyVersion: 1,
  rules: [
    {
      ruleId: "regra-saida-por-transferencia-demo",
      appliesToMobilityFactTypeId: DEMO_MOBILITY_FACT_TYPES.departureByTransfer,
      producesSituationDefinitionId: DEMO_TRANSFER_SITUATIONS.transferred,
    },
  ],
};

// ------------------------------------------------------------ Configuração

export const demonstrationTransferConfiguration: InstitutionalTransferGovernanceConfiguration = {
  configurationId: "cfg-mobilidade-institucional-demo",
  configurationVersion: 1,
  processKinds: [
    {
      processKindDefinitionId: DEMO_TRANSFER_PROCESS_KINDS.betweenNetworkUnits,
      labelSnapshot: "Mobilidade entre unidades da Rede",
      initialStageDefinitionId: DEMO_TRANSFER_STAGES.requested,
    },
    {
      processKindDefinitionId: DEMO_TRANSFER_PROCESS_KINDS.networkExit,
      labelSnapshot: "Saída da Rede",
      initialStageDefinitionId: DEMO_TRANSFER_STAGES.requested,
    },
    {
      processKindDefinitionId: DEMO_TRANSFER_PROCESS_KINDS.networkEntry,
      labelSnapshot: "Ingresso na Rede",
      initialStageDefinitionId: DEMO_TRANSFER_STAGES.requested,
    },
  ],
  stages: [
    { stageDefinitionId: DEMO_TRANSFER_STAGES.requested, labelSnapshot: "Solicitado" },
    { stageDefinitionId: DEMO_TRANSFER_STAGES.underReview, labelSnapshot: "Em análise" },
    {
      stageDefinitionId: DEMO_TRANSFER_STAGES.departureRecorded,
      labelSnapshot: "Saída registrada",
    },
    { stageDefinitionId: DEMO_TRANSFER_STAGES.welcomed, labelSnapshot: "Acolhido no destino" },
    { stageDefinitionId: DEMO_TRANSFER_STAGES.cancelled, labelSnapshot: "Cancelado" },
  ],
  transitions: [
    {
      transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.open,
      fromStageDefinitionId: null,
      toStageDefinitionId: DEMO_TRANSFER_STAGES.requested,
      reasonRequired: true,
      allowedReasonDefinitionIds: [
        DEMO_TRANSFER_REASONS.addressChange,
        DEMO_TRANSFER_REASONS.familyRequest,
        DEMO_TRANSFER_REASONS.administrative,
      ],
    },
    {
      transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.review,
      fromStageDefinitionId: DEMO_TRANSFER_STAGES.requested,
      toStageDefinitionId: DEMO_TRANSFER_STAGES.underReview,
    },
    {
      transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.recordDeparture,
      fromStageDefinitionId: DEMO_TRANSFER_STAGES.underReview,
      toStageDefinitionId: DEMO_TRANSFER_STAGES.departureRecorded,
      requirements: [
        {
          requirementDefinitionId: "req-ato-originador-da-saida-demo",
          labelSnapshot: "Ato institucional originador da saída",
          evaluatorId: TRANSFER_REQUIREMENT_EVALUATOR_IDS.originatingAct,
          effectByStatus: {
            satisfeito: DEMO_TRANSFER_REQUIREMENT_EFFECTS.advisory,
            "nao-satisfeito": DEMO_TRANSFER_REQUIREMENT_EFFECTS.prevents,
            inconclusivo: DEMO_TRANSFER_REQUIREMENT_EFFECTS.prevents,
          },
        },
      ],
      effects: [
        {
          effectDefinitionId: DEMO_TRANSFER_EFFECTS.closeAllocations,
          effectExecutorId: TRANSFER_EFFECT_EXECUTOR_IDS.closeAllocationValidity,
        },
        {
          effectDefinitionId: DEMO_TRANSFER_EFFECTS.resolveParticipations,
          effectExecutorId: TRANSFER_EFFECT_EXECUTOR_IDS.applyParticipationEffectPolicy,
        },
        {
          effectDefinitionId: DEMO_TRANSFER_EFFECTS.closeEnrollment,
          effectExecutorId: TRANSFER_EFFECT_EXECUTOR_IDS.closeEnrollmentValidity,
        },
        {
          effectDefinitionId: DEMO_TRANSFER_EFFECTS.evaluateBond,
          effectExecutorId: TRANSFER_EFFECT_EXECUTOR_IDS.evaluateSchoolBondEffect,
        },
        {
          effectDefinitionId: DEMO_TRANSFER_EFFECTS.recordInterval,
          effectExecutorId: TRANSFER_EFFECT_EXECUTOR_IDS.recordTransitionInterval,
        },
        {
          effectDefinitionId: DEMO_TRANSFER_EFFECTS.publishMobility,
          effectExecutorId: TRANSFER_EFFECT_EXECUTOR_IDS.publishMobilityFact,
          parameters: {
            mobilityFactTypeId: DEMO_MOBILITY_FACT_TYPES.departureByTransfer,
          },
        },
      ],
    },
    {
      transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.welcome,
      fromStageDefinitionId: DEMO_TRANSFER_STAGES.departureRecorded,
      toStageDefinitionId: DEMO_TRANSFER_STAGES.welcomed,
      effects: [
        {
          effectDefinitionId: DEMO_TRANSFER_EFFECTS.publishMobility,
          effectExecutorId: TRANSFER_EFFECT_EXECUTOR_IDS.publishMobilityFact,
          parameters: { mobilityFactTypeId: DEMO_MOBILITY_FACT_TYPES.entryByTransfer },
        },
      ],
    },
    {
      transitionDefinitionId: DEMO_TRANSFER_TRANSITIONS.cancel,
      fromStageDefinitionId: DEMO_TRANSFER_STAGES.requested,
      toStageDefinitionId: DEMO_TRANSFER_STAGES.cancelled,
      reasonRequired: true,
      allowedReasonDefinitionIds: [DEMO_TRANSFER_REASONS.withdrawal],
    },
  ],
  reasons: [
    {
      reasonDefinitionId: DEMO_TRANSFER_REASONS.addressChange,
      labelSnapshot: "Mudança de domicílio",
    },
    {
      reasonDefinitionId: DEMO_TRANSFER_REASONS.familyRequest,
      labelSnapshot: "Solicitação da família",
    },
    {
      reasonDefinitionId: DEMO_TRANSFER_REASONS.administrative,
      labelSnapshot: "Decisão administrativa",
    },
    {
      reasonDefinitionId: DEMO_TRANSFER_REASONS.withdrawal,
      labelSnapshot: "Desistência do pedido",
    },
  ],
  requirementEffects: [
    {
      effectDefinitionId: DEMO_TRANSFER_REQUIREMENT_EFFECTS.prevents,
      labelSnapshot: "Impede a transição enquanto não atendido",
      preventsTransition: true,
      severity: "blocker",
    },
    {
      effectDefinitionId: DEMO_TRANSFER_REQUIREMENT_EFFECTS.advisory,
      labelSnapshot: "Registra pendência sem impedir",
      preventsTransition: false,
      severity: "info",
    },
  ],
  contextReferenceTypes: [
    {
      contextReferenceTypeDefinitionId: DEMO_TRANSFER_CONTEXT_TYPES.networkUnit,
      labelSnapshot: "Unidade escolar da Rede",
      payloadSchemaDefinitionId: DEMO_TRANSFER_CONTEXT_SCHEMAS.networkUnit,
    },
    {
      contextReferenceTypeDefinitionId: DEMO_TRANSFER_CONTEXT_TYPES.externalInstitution,
      labelSnapshot: "Instituição externa",
      payloadSchemaDefinitionId: DEMO_TRANSFER_CONTEXT_SCHEMAS.externalInstitution,
    },
  ],
  payloadSchemas: demonstrationTransferPayloadSchemas,
  documentStatuses: [
    {
      documentStatusDefinitionId: DEMO_TRANSFER_DOCUMENT_STATUSES.pending,
      labelSnapshot: "Pendente",
    },
    {
      documentStatusDefinitionId: DEMO_TRANSFER_DOCUMENT_STATUSES.issued,
      labelSnapshot: "Emitido",
    },
    {
      documentStatusDefinitionId: DEMO_TRANSFER_DOCUMENT_STATUSES.received,
      labelSnapshot: "Recebido",
    },
    {
      documentStatusDefinitionId: DEMO_TRANSFER_DOCUMENT_STATUSES.waived,
      labelSnapshot: "Dispensado",
    },
  ],
  verificationStatuses: [
    {
      verificationStatusDefinitionId: DEMO_TRANSFER_VERIFICATION_STATUSES.pending,
      labelSnapshot: "Conferência pendente",
    },
    {
      verificationStatusDefinitionId: DEMO_TRANSFER_VERIFICATION_STATUSES.confirmed,
      labelSnapshot: "Conferido",
    },
  ],
  transitionIntervalKinds: [
    {
      transitionKindDefinitionId: DEMO_TRANSITION_INTERVAL_KINDS.regulatoryTransit,
      labelSnapshot: "Trânsito entre unidades (demonstrativo)",
    },
    {
      transitionKindDefinitionId: DEMO_TRANSITION_INTERVAL_KINDS.awaitingWelcome,
      labelSnapshot: "Aguardando acolhimento no destino (demonstrativo)",
    },
  ],
  participationEffectPolicy: demonstrationParticipationEffectPolicy,
  schoolBondEffectPolicy: demonstrationSchoolBondEffectPolicy,
};
