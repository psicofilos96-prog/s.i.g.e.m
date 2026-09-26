/**
 * Etapa 13H — Configuração e fatos DEMONSTRATIVOS do acompanhamento pedagógico.
 *
 * Nada aqui é norma homologada da Rede. Todos os tipos, estados, motivos,
 * canais, destinos e finalidades são dados configurados: o motor não os conhece.
 * Os fatos acadêmicos aparecem apenas como REFERÊNCIAS (12L, 12H.1, 13B–13F) e
 * observações docentes preservam autoria e permanecem do professor.
 */
import type { StudentLifeProvenance } from "@/features/student-life/dossier-types";
import type { StudentResponsibilityAssignment } from "@/features/student-life/dossier-types";
import {
  GUIDANCE_COMBINATOR_IDS,
  GUIDANCE_COMPARATOR_IDS,
  GUIDANCE_CONDITION_KIND_IDS,
} from "./signal-engine";
import type {
  CaseEvent,
  CaseParticipation,
  CaseResponsibilityAssignment,
  CommunicationRecord,
  EffectivenessAssessment,
  FollowUpPlan,
  FollowUpPlanVersion,
  GuidanceFact,
  InterventionRecord,
  ObservedFactRecord,
  PedagogicalFollowUpCase,
  ReferralPolicy,
  ReferralRecord,
  ReferralResponseEvent,
  SignalDefinition,
  SignalLifecycleEvent,
} from "./guidance-types";

const provenance = (recordedAt: string, agentId = "agente-orientacao-demo"): StudentLifeProvenance => ({
  originTypeId: "registro-demonstrativo-de-orientacao",
  recordedAt,
  recordedByAgentId: agentId,
});

// ------------------------------------------------------------ Catálogos

export const GUIDANCE_CAPACITIES = {
  consultPedagogicalPath: "cap-consultar-percurso-pedagogico",
  readGuidanceContent: "cap-ler-conteudo-de-acompanhamento",
  openFollowUpCase: "cap-abrir-acompanhamento-pedagogico",
  registerIntervention: "cap-registrar-intervencao-pedagogica",
  issueReferral: "cap-encaminhar-questao-institucional",
  analyseSignal: "cap-analisar-sinal-de-atencao",
  communicateWithFamily: "cap-comunicar-com-responsavel",
} as const;

/** Capacidade de responsabilidade da 13F exigida para falar com o responsável. */
export const GUIDANCE_RESPONSIBILITY_CAPACITY =
  "cap-representar-aluno-perante-a-escola";

export const GUIDANCE_PURPOSES = {
  pedagogicalFollowUp: "finalidade-acompanhamento-pedagogico",
  familyCommunication: "finalidade-comunicacao-com-responsavel",
} as const;

export const GUIDANCE_OPERATIONS = {
  readPedagogicalMetadata: "operacao-consultar-metadados-pedagogicos",
  analyseSignal: "operacao-analisar-sinal",
  openCase: "operacao-abrir-acompanhamento",
  registerIntervention: "operacao-registrar-intervencao",
  reviewPlan: "operacao-revisar-plano",
  issueReferral: "operacao-encaminhar",
} as const;

export const GUIDANCE_SCOPE_KINDS = {
  schoolUnit: "escopo-unidade-escolar",
  academicClass: "escopo-turma",
} as const;

export const GUIDANCE_SENSITIVITY = {
  institutional: "publico-institucional",
  restricted: "restrito-orientacao",
} as const;

export const GUIDANCE_SIGNAL_STATES = {
  current: "sinal-vigente",
  underAnalysis: "sinal-em-analise",
  analysed: "sinal-analisado",
  dismissedAfterAnalysis: "sinal-descartado-apos-analise",
  linkedToCase: "sinal-relacionado-a-acompanhamento",
} as const;

export const GUIDANCE_CASE_STATES = {
  opened: "acompanhamento-aberto",
  inProgress: "acompanhamento-em-curso",
  awaitingThirdParty: "acompanhamento-aguardando-terceiro",
  closed: "acompanhamento-encerrado",
} as const;

export const GUIDANCE_CASE_CLOSING_REASONS = {
  objectivesFollowed: "encerrado-apos-acompanhamento-realizado",
  studentTransferred: "encerrado-por-mobilidade-do-estudante",
  referredElsewhere: "encerrado-por-encaminhamento-a-outro-contexto",
  withoutResolution: "encerrado-sem-resolucao-declarada",
} as const;

export const GUIDANCE_OPENING_MODES = {
  fromSignal: "abertura-a-partir-de-sinal",
  institutionalRequest: "abertura-por-provocacao-institucional",
  fromReferral: "abertura-a-partir-de-encaminhamento",
  familyRequest: "abertura-por-solicitacao-da-familia",
} as const;

export const GUIDANCE_INTERVENTION_TYPES = {
  studentMeeting: "atendimento-ao-estudante",
  guardianMeeting: "reuniao-com-responsavel",
  teacherArticulation: "articulacao-com-professor",
  planFollowUp: "retorno-de-plano",
} as const;

export const GUIDANCE_COMMUNICATION = {
  natures: {
    guardianContact: "comunicacao-com-responsavel",
    teacherContact: "comunicacao-com-professor",
    externalTeam: "comunicacao-com-equipe-externa",
  },
  channels: {
    inPerson: "canal-presencial",
    phone: "canal-telefonico",
    writtenNotice: "canal-comunicado-escrito",
  },
  outcomes: {
    acknowledged: "comunicacao-recebida",
    scheduled: "atendimento-agendado",
    unreachable: "nao-foi-possivel-contato",
  },
} as const;

export const GUIDANCE_REFERRAL_TYPES = {
  toCollegialBody: "encaminhamento-a-colegiado",
  toSchoolManagement: "encaminhamento-a-gestao-escolar",
  toExternalNetwork: "encaminhamento-a-rede-externa",
  informationalNotice: "comunicacao-de-ciencia",
} as const;

export const GUIDANCE_SOURCE_TYPES = {
  canonicalAcademicProjection: "projecao-canonica-do-percurso-12l",
  officialAttendanceClosing: "fechamento-oficial-de-frequencia-12h1",
  teacherObservation: "observacao-docente-do-diario",
  continuityObligation: "obrigacao-de-continuidade-13e",
  dossierRecord: "registro-de-prontuario-13f",
  signalOccurrence: "ocorrencia-de-sinal-13h",
} as const;

export const GUIDANCE_DOMAIN_IDS = {
  guidance: "dominio-13h-acompanhamento-pedagogico",
} as const;

export const GUIDANCE_LINK_TARGETS = {
  studentProfile: "destino-ficha-pedagogica-do-aluno",
  classView: "destino-visao-pedagogica-da-turma",
} as const;

export const GUIDANCE_PROCESS_TYPES = {
  signalAnalysis: "processo-analise-de-sinal-demo",
  followUpCase: "processo-acompanhamento-pedagogico-demo",
  referral: "processo-encaminhamento-demo",
} as const;

// ------------------------------------------------------ Definições de sinal

/** Versão 1: parâmetro de 75%. Preservada porque detectou ocorrência histórica. */
export const attendanceSignalDefinitionV1: SignalDefinition = {
  signalDefinitionId: "sin-frequencia-abaixo-do-parametro-demo",
  definitionVersion: 1,
  labelSnapshot: "Frequência abaixo do parâmetro configurado",
  descriptionSnapshot:
    "Condição configurada sobre o fato oficial de frequência do ciclo. Não é diagnóstico nem juízo sobre o estudante.",
  signalKindDefinitionId: "natureza-frequencia",
  evaluationScopeKindDefinitionId: "escopo-estudante-no-ciclo",
  conditionCombinatorId: GUIDANCE_COMBINATOR_IDS.all,
  conditions: [
    {
      conditionKindId: GUIDANCE_CONDITION_KIND_IDS.compareFact,
      parameters: {
        factKey: "proporcao-de-frequencia-do-ciclo",
        comparatorId: GUIDANCE_COMPARATOR_IDS.lessThan,
        parameter: 75,
      },
    },
  ],
  lifecycleStateDefinitionIds: Object.values(GUIDANCE_SIGNAL_STATES),
  initialLifecycleStateDefinitionId: GUIDANCE_SIGNAL_STATES.current,
  sensitivityLevelDefinitionId: GUIDANCE_SENSITIVITY.institutional,
  homologated: true,
  validFrom: "2027-02-01",
  validUntil: "2027-06-30",
  provenance: provenance("2027-02-01T10:00:00.000Z"),
};

/** Versão 2: parâmetro alterado para 70%. Não reescreve o passado. */
export const attendanceSignalDefinitionV2: SignalDefinition = {
  ...attendanceSignalDefinitionV1,
  definitionVersion: 2,
  conditions: [
    {
      conditionKindId: GUIDANCE_CONDITION_KIND_IDS.compareFact,
      parameters: {
        factKey: "proporcao-de-frequencia-do-ciclo",
        comparatorId: GUIDANCE_COMPARATOR_IDS.lessThan,
        parameter: 70,
      },
    },
  ],
  validFrom: "2027-07-01",
  validUntil: null,
  provenance: provenance("2027-07-01T10:00:00.000Z"),
};

/** Sinal por contagem: quantos componentes com pendência declarada. */
export const pendingComponentsSignalDefinition: SignalDefinition = {
  signalDefinitionId: "sin-componentes-com-pendencia-demo",
  definitionVersion: 1,
  labelSnapshot: "Quantidade de componentes com pendência declarada",
  signalKindDefinitionId: "natureza-percurso",
  evaluationScopeKindDefinitionId: "escopo-componente",
  conditionCombinatorId: GUIDANCE_COMBINATOR_IDS.all,
  conditions: [
    {
      conditionKindId: GUIDANCE_CONDITION_KIND_IDS.countFactsSatisfying,
      parameters: {
        factKey: "pendencia-declarada-no-componente",
        itemComparatorId: GUIDANCE_COMPARATOR_IDS.isTrue,
        countComparatorId: GUIDANCE_COMPARATOR_IDS.greaterOrEqual,
        countParameter: 2,
      },
    },
  ],
  lifecycleStateDefinitionIds: Object.values(GUIDANCE_SIGNAL_STATES),
  initialLifecycleStateDefinitionId: GUIDANCE_SIGNAL_STATES.current,
  sensitivityLevelDefinitionId: GUIDANCE_SENSITIVITY.institutional,
  homologated: true,
  validFrom: "2027-02-01",
  validUntil: null,
  provenance: provenance("2027-02-01T10:05:00.000Z"),
};

/** Rascunho não homologado: capacidade configurada, sem valor institucional. */
export const draftSignalDefinition: SignalDefinition = {
  ...pendingComponentsSignalDefinition,
  signalDefinitionId: "sin-rascunho-nao-homologado-demo",
  labelSnapshot: "Rascunho de sinal ainda não homologado",
  homologated: false,
};

export const demonstrationSignalDefinitions: readonly SignalDefinition[] = [
  attendanceSignalDefinitionV1,
  attendanceSignalDefinitionV2,
  pendingComponentsSignalDefinition,
  draftSignalDefinition,
];

// --------------------------------------------- Fatos canônicos referenciados

/** Fatos de 12L/12H.1 lidos por adaptador; a 13H nunca os grava. */
export const demonstrationGuidanceFacts: Readonly<Record<string, readonly GuidanceFact[]>> = {
  "alu-001": [
    {
      factKey: "proporcao-de-frequencia-do-ciclo",
      value: 72,
      unit: "proporção percentual",
      labelSnapshot: "Proporção de frequência apurada no fechamento oficial",
      sourceReference: {
        sourceTypeDefinitionId: GUIDANCE_SOURCE_TYPES.officialAttendanceClosing,
        entityId: "fec-freq-demo-001",
        entityVersion: 2,
        sourceProjectionSchemaVersion: 1,
      },
    },
    {
      factKey: "pendencia-declarada-no-componente",
      scopeKey: "componente:lin",
      value: true,
      sourceReference: {
        sourceTypeDefinitionId: GUIDANCE_SOURCE_TYPES.canonicalAcademicProjection,
        entityId: "proj-demo-001",
        entityVersion: 1,
      },
    },
    {
      factKey: "pendencia-declarada-no-componente",
      scopeKey: "componente:mat",
      value: true,
      sourceReference: {
        sourceTypeDefinitionId: GUIDANCE_SOURCE_TYPES.canonicalAcademicProjection,
        entityId: "proj-demo-001",
        entityVersion: 1,
      },
    },
  ],
  "alu-002": [
    {
      factKey: "proporcao-de-frequencia-do-ciclo",
      value: null,
      unavailableReason:
        "Ciclo sem fechamento oficial de frequência homologado: o fato não existe e nada é presumido.",
      sourceReference: {
        sourceTypeDefinitionId: GUIDANCE_SOURCE_TYPES.officialAttendanceClosing,
        entityId: "fec-freq-demo-002",
      },
    },
  ],
};

// -------------------------------------------- Ciclo de vida dos sinais

export const demonstrationSignalLifecycleEvents: readonly SignalLifecycleEvent[] = [
  {
    eventId: "sinal-evt-001",
    occurrenceId: "ocr-sinal-demo-001",
    eventTypeDefinitionId: "sinal-encaminhado-para-analise",
    fromStateDefinitionId: GUIDANCE_SIGNAL_STATES.current,
    toStateDefinitionId: GUIDANCE_SIGNAL_STATES.underAnalysis,
    effectiveDate: "2027-03-02",
    actorReference: { agentId: "agente-orientacao-demo", agentNameSnapshot: "Agente da Orientação" },
    provenance: provenance("2027-03-02T13:00:00.000Z"),
  },
  {
    eventId: "sinal-evt-002",
    occurrenceId: "ocr-sinal-demo-001",
    eventTypeDefinitionId: "sinal-relacionado-a-acompanhamento",
    fromStateDefinitionId: GUIDANCE_SIGNAL_STATES.underAnalysis,
    toStateDefinitionId: GUIDANCE_SIGNAL_STATES.linkedToCase,
    effectiveDate: "2027-03-05",
    relatedCaseId: "caso-demo-001",
    provenance: provenance("2027-03-05T09:30:00.000Z"),
  },
];

// ------------------------------------------------------------------ Casos

export const demonstrationCases: readonly PedagogicalFollowUpCase[] = [
  {
    caseId: "caso-demo-001",
    subjects: [
      {
        subjectRoleDefinitionId: "estudante-acompanhado",
        reference: {
          entityKindDefinitionId: "aluno",
          entityId: "alu-001",
          labelSnapshot: "Estudante demonstrativo 1",
        },
      },
    ],
    openingModeDefinitionId: GUIDANCE_OPENING_MODES.fromSignal,
    foundingReferences: [
      {
        sourceTypeDefinitionId: GUIDANCE_SOURCE_TYPES.signalOccurrence,
        entityId: "ocr-sinal-demo-001",
      },
      {
        sourceTypeDefinitionId: GUIDANCE_SOURCE_TYPES.teacherObservation,
        entityId: "obs-docente-demo-001",
        labelSnapshot: "Observação registrada no Diário pelo professor",
        authorReference: {
          entityKindDefinitionId: "profissional",
          entityId: "pro-006",
          labelSnapshot: "Professor responsável pela turma",
        },
      },
    ],
    processingPurposeDefinitionId: GUIDANCE_PURPOSES.pedagogicalFollowUp,
    scopeEntities: [
      { entityKindDefinitionId: GUIDANCE_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
      { entityKindDefinitionId: GUIDANCE_SCOPE_KINDS.academicClass, entityId: "tur-001" },
    ],
    openedOn: "2027-03-05",
    sensitivityLevelDefinitionId: GUIDANCE_SENSITIVITY.institutional,
    lifecycleStateDefinitionIds: Object.values(GUIDANCE_CASE_STATES),
    initialLifecycleStateDefinitionId: GUIDANCE_CASE_STATES.opened,
    provenance: provenance("2027-03-05T09:40:00.000Z"),
  },
  {
    caseId: "caso-demo-002",
    subjects: [
      {
        subjectRoleDefinitionId: "estudante-acompanhado",
        reference: { entityKindDefinitionId: "aluno", entityId: "alu-001" },
      },
      {
        subjectRoleDefinitionId: "estudante-acompanhado",
        reference: { entityKindDefinitionId: "aluno", entityId: "alu-002" },
      },
    ],
    openingModeDefinitionId: GUIDANCE_OPENING_MODES.institutionalRequest,
    foundingReferences: [],
    processingPurposeDefinitionId: GUIDANCE_PURPOSES.pedagogicalFollowUp,
    scopeEntities: [
      { entityKindDefinitionId: GUIDANCE_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
    openedOn: "2027-03-12",
    sensitivityLevelDefinitionId: GUIDANCE_SENSITIVITY.restricted,
    lifecycleStateDefinitionIds: Object.values(GUIDANCE_CASE_STATES),
    initialLifecycleStateDefinitionId: GUIDANCE_CASE_STATES.opened,
    provenance: provenance("2027-03-12T08:00:00.000Z"),
  },
  {
    caseId: "caso-demo-003",
    subjects: [
      {
        subjectRoleDefinitionId: "estudante-acompanhado",
        reference: { entityKindDefinitionId: "aluno", entityId: "alu-002" },
      },
    ],
    openingModeDefinitionId: GUIDANCE_OPENING_MODES.familyRequest,
    foundingReferences: [],
    processingPurposeDefinitionId: GUIDANCE_PURPOSES.pedagogicalFollowUp,
    scopeEntities: [
      { entityKindDefinitionId: GUIDANCE_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
    openedOn: "2027-02-10",
    sensitivityLevelDefinitionId: GUIDANCE_SENSITIVITY.institutional,
    lifecycleStateDefinitionIds: Object.values(GUIDANCE_CASE_STATES),
    initialLifecycleStateDefinitionId: GUIDANCE_CASE_STATES.opened,
    provenance: provenance("2027-02-10T08:00:00.000Z"),
  },
];

export const demonstrationCaseEvents: readonly CaseEvent[] = [
  {
    eventId: "caso-evt-001",
    caseId: "caso-demo-001",
    eventTypeDefinitionId: "acompanhamento-iniciado",
    fromStateDefinitionId: null,
    toStateDefinitionId: GUIDANCE_CASE_STATES.inProgress,
    effectiveDate: "2027-03-06",
    provenance: provenance("2027-03-06T10:00:00.000Z"),
  },
  {
    eventId: "caso-evt-002",
    caseId: "caso-demo-003",
    eventTypeDefinitionId: "acompanhamento-encerrado",
    fromStateDefinitionId: GUIDANCE_CASE_STATES.opened,
    toStateDefinitionId: GUIDANCE_CASE_STATES.closed,
    effectiveDate: "2027-03-01",
    reasonDefinitionId: GUIDANCE_CASE_CLOSING_REASONS.withoutResolution,
    concludesCase: true,
    provenance: provenance("2027-03-01T17:00:00.000Z"),
  },
];

export const demonstrationCaseResponsibilities: readonly CaseResponsibilityAssignment[] = [
  {
    assignmentId: "resp-caso-001",
    caseId: "caso-demo-001",
    agentReference: {
      agentId: "agente-orientacao-demo",
      agentNameSnapshot: "Agente da Orientação (demonstrativo)",
    },
    capacityDefinitionId: GUIDANCE_CAPACITIES.openFollowUpCase,
    validFrom: "2027-03-05",
    validUntil: "2027-04-14",
    provenance: provenance("2027-03-05T09:41:00.000Z"),
  },
  {
    assignmentId: "resp-caso-002",
    caseId: "caso-demo-001",
    agentReference: {
      agentId: "agente-orientacao-substituto-demo",
      agentNameSnapshot: "Agente da Orientação substituto (demonstrativo)",
    },
    capacityDefinitionId: GUIDANCE_CAPACITIES.openFollowUpCase,
    validFrom: "2027-04-15",
    validUntil: null,
    provenance: provenance("2027-04-15T09:00:00.000Z"),
  },
];

export const demonstrationCaseParticipations: readonly CaseParticipation[] = [
  {
    participationId: "part-caso-001",
    caseId: "caso-demo-001",
    participantReference: {
      entityKindDefinitionId: "profissional",
      entityId: "pro-006",
      labelSnapshot: "Professor da turma",
    },
    participationRoleDefinitionId: "participante-professor",
    validFrom: "2027-03-06",
    validUntil: null,
    provenance: provenance("2027-03-06T10:05:00.000Z"),
  },
];

// ------------------------------------------------------------------ Planos

export const demonstrationPlans: readonly FollowUpPlan[] = [
  {
    planId: "plano-demo-001",
    caseId: "caso-demo-001",
    labelSnapshot: "Plano de acompanhamento demonstrativo",
    provenance: provenance("2027-03-06T11:00:00.000Z"),
  },
];

export const demonstrationPlanVersions: readonly FollowUpPlanVersion[] = [
  {
    planVersionId: "plano-versao-001",
    planId: "plano-demo-001",
    version: 1,
    createdAt: "2027-03-06",
    createdBy: { agentId: "agente-orientacao-demo" },
    items: [
      {
        planItemId: "plano-item-001",
        objectiveSnapshot: "Acompanhar a participação do estudante nas atividades previstas.",
        actionTypeDefinitionId: GUIDANCE_INTERVENTION_TYPES.studentMeeting,
        dueDate: "2027-03-20",
        itemStateDefinitionId: "item-previsto",
      },
      {
        planItemId: "plano-item-002",
        objectiveSnapshot: "Articular com o professor da turma o contexto observado.",
        actionTypeDefinitionId: GUIDANCE_INTERVENTION_TYPES.teacherArticulation,
        itemStateDefinitionId: "item-previsto",
      },
    ],
    provenance: provenance("2027-03-06T11:00:00.000Z"),
  },
  {
    planVersionId: "plano-versao-002",
    planId: "plano-demo-001",
    version: 2,
    precedingPlanVersionId: "plano-versao-001",
    revisionReasonDefinitionId: "revisao-por-mudanca-de-contexto",
    createdAt: "2027-04-02",
    createdBy: { agentId: "agente-orientacao-demo" },
    items: [
      {
        planItemId: "plano-item-003",
        objectiveSnapshot: "Retomar o acompanhamento com a participação do responsável.",
        actionTypeDefinitionId: GUIDANCE_INTERVENTION_TYPES.guardianMeeting,
        dueDate: "2027-04-20",
        itemStateDefinitionId: "item-previsto",
      },
    ],
    provenance: provenance("2027-04-02T11:00:00.000Z"),
  },
];

// ------------------------------------------------- Intervenções e resultados

export const demonstrationInterventions: readonly InterventionRecord[] = [
  {
    interventionId: "interv-demo-001",
    caseId: "caso-demo-001",
    interventionTypeDefinitionId: GUIDANCE_INTERVENTION_TYPES.studentMeeting,
    occurredAt: "2027-03-10",
    participants: [
      {
        participantReference: { entityKindDefinitionId: "aluno", entityId: "alu-001" },
        participationRoleDefinitionId: "participante-estudante",
      },
    ],
    authorReference: { agentId: "agente-orientacao-demo" },
    processingPurposeDefinitionId: GUIDANCE_PURPOSES.pedagogicalFollowUp,
    structuredPayload: {
      resumo: "Atendimento realizado conforme item previsto no plano.",
      conteudoRestrito:
        "Conteúdo de atendimento restrito à Orientação, fora da finalidade da Secretaria.",
    },
    sensitivityLevelDefinitionId: GUIDANCE_SENSITIVITY.restricted,
    sourceReferences: [
      {
        sourceTypeDefinitionId: GUIDANCE_SOURCE_TYPES.teacherObservation,
        entityId: "obs-docente-demo-001",
        authorReference: { entityKindDefinitionId: "profissional", entityId: "pro-006" },
      },
    ],
    planItemId: "plano-item-001",
    provenance: provenance("2027-03-10T15:00:00.000Z"),
  },
];

export const demonstrationObservedFacts: readonly ObservedFactRecord[] = [
  {
    observationId: "obs-resultado-demo-001",
    caseId: "caso-demo-001",
    relatedInterventionId: "interv-demo-001",
    observedFactReference: {
      sourceTypeDefinitionId: GUIDANCE_SOURCE_TYPES.officialAttendanceClosing,
      entityId: "fec-freq-demo-001",
      entityVersion: 3,
    },
    observedAt: "2027-04-30",
    noteSnapshot:
      "Fato posterior observado e referenciado. Nenhuma relação de causa é afirmada pelo registro.",
    assertsCausality: false,
    provenance: provenance("2027-04-30T16:00:00.000Z"),
  },
];

export const demonstrationEffectivenessAssessments: readonly EffectivenessAssessment[] = [
  {
    assessmentId: "aval-efetividade-demo-001",
    caseId: "caso-demo-001",
    assessmentTypeDefinitionId: "avaliacao-institucional-de-acompanhamento",
    conclusionDefinitionId: "conclusao-sem-relacao-estabelecida",
    rationaleSnapshot:
      "Avaliação institucional registrada por agente competente; não se afirma causalidade entre a intervenção e o fato observado.",
    actorReference: { agentId: "agente-orientacao-demo" },
    capacityDefinitionId: GUIDANCE_CAPACITIES.registerIntervention,
    assessedAt: "2027-05-05",
    consideredObservationIds: ["obs-resultado-demo-001"],
    provenance: provenance("2027-05-05T16:00:00.000Z"),
  },
];

// ------------------------------------------------------------ Comunicação

export const demonstrationCommunications: readonly CommunicationRecord[] = [
  {
    communicationId: "com-demo-001",
    caseId: "caso-demo-001",
    communicationNatureDefinitionId: GUIDANCE_COMMUNICATION.natures.guardianContact,
    channelDefinitionId: GUIDANCE_COMMUNICATION.channels.phone,
    processingPurposeDefinitionId: GUIDANCE_PURPOSES.familyCommunication,
    occurredAt: "2027-03-08",
    participants: [
      {
        participantReference: { entityKindDefinitionId: "pessoa", entityId: "pes-demo-001" },
        participationRoleDefinitionId: "interlocutor-responsavel",
        authorizationBasisReference: {
          sourceTypeDefinitionId: "atribuicao-de-responsabilidade-13f",
          entityId: "resp-demo-001",
        },
      },
    ],
    outcomeDefinitionId: GUIDANCE_COMMUNICATION.outcomes.scheduled,
    sensitivityLevelDefinitionId: GUIDANCE_SENSITIVITY.institutional,
    provenance: provenance("2027-03-08T10:00:00.000Z"),
  },
];

/** Responsabilidades da 13F consumidas pela 13H — nunca recriadas aqui. */
export const demonstrationResponsibilityAssignments: readonly StudentResponsibilityAssignment[] = [
  {
    assignmentId: "resp-demo-001",
    personId: "pes-demo-001",
    subjectReference: { entityKindDefinitionId: "aluno", entityId: "alu-001" },
    responsibilityCapacityDefinitionIds: [GUIDANCE_RESPONSIBILITY_CAPACITY],
    validFrom: "2027-01-01",
    validUntil: null,
    provenance: provenance("2027-01-01T08:00:00.000Z"),
  },
];

// -------------------------------------------------------- Encaminhamentos

export const demonstrationReferralPolicy: ReferralPolicy = {
  policyId: "pol-encaminhamento-orientacao-demo",
  policyVersion: 1,
  homologated: true,
  expectations: [
    {
      responseExpectationDefinitionId: "expectativa-sem-retorno-obrigatorio",
      labelSnapshot: "Sem retorno obrigatório",
      requiresResponse: false,
    },
    {
      responseExpectationDefinitionId: "expectativa-resposta-estruturada",
      labelSnapshot: "Resposta estruturada esperada",
      requiresResponse: true,
      responseWindowDays: 15,
    },
    {
      responseExpectationDefinitionId: "expectativa-ciencia",
      labelSnapshot: "Ciência registrada",
      requiresResponse: false,
    },
  ],
  expectationsByReferralType: {
    [GUIDANCE_REFERRAL_TYPES.toCollegialBody]: "expectativa-resposta-estruturada",
    [GUIDANCE_REFERRAL_TYPES.toSchoolManagement]: "expectativa-resposta-estruturada",
    [GUIDANCE_REFERRAL_TYPES.informationalNotice]: "expectativa-sem-retorno-obrigatorio",
  },
  requiredCapacityByReferralType: {
    [GUIDANCE_REFERRAL_TYPES.toCollegialBody]: [GUIDANCE_CAPACITIES.issueReferral],
    [GUIDANCE_REFERRAL_TYPES.toSchoolManagement]: [GUIDANCE_CAPACITIES.issueReferral],
    [GUIDANCE_REFERRAL_TYPES.informationalNotice]: [GUIDANCE_CAPACITIES.issueReferral],
  },
};

export const demonstrationReferrals: readonly ReferralRecord[] = [
  {
    referralId: "enc-demo-001",
    caseId: "caso-demo-001",
    referralTypeDefinitionId: GUIDANCE_REFERRAL_TYPES.toCollegialBody,
    destinationReference: {
      entityKindDefinitionId: "colegiado",
      entityId: "col-demo-001",
      labelSnapshot: "Colegiado configurado (12J)",
    },
    reasonSnapshot:
      "Questão encaminhada para apreciação do colegiado competente, sem presunção de decisão.",
    sourceReferences: [
      {
        sourceTypeDefinitionId: GUIDANCE_SOURCE_TYPES.signalOccurrence,
        entityId: "ocr-sinal-demo-001",
      },
    ],
    issuedAt: "2027-03-15",
    issuedBy: { agentId: "agente-orientacao-demo" },
    referralPolicyId: demonstrationReferralPolicy.policyId,
    referralPolicyVersion: demonstrationReferralPolicy.policyVersion,
    sensitivityLevelDefinitionId: GUIDANCE_SENSITIVITY.institutional,
    provenance: provenance("2027-03-15T14:00:00.000Z"),
  },
  {
    referralId: "enc-demo-002",
    referralTypeDefinitionId: GUIDANCE_REFERRAL_TYPES.informationalNotice,
    destinationReference: {
      entityKindDefinitionId: "setor-institucional",
      entityId: "set-demo-001",
      labelSnapshot: "Setor institucional destinatário",
    },
    reasonSnapshot: "Comunicação de ciência, sem obrigação de resposta pela política.",
    sourceReferences: [],
    issuedAt: "2027-03-18",
    issuedBy: { agentId: "agente-orientacao-demo" },
    referralPolicyId: demonstrationReferralPolicy.policyId,
    referralPolicyVersion: demonstrationReferralPolicy.policyVersion,
    sensitivityLevelDefinitionId: GUIDANCE_SENSITIVITY.institutional,
    provenance: provenance("2027-03-18T14:00:00.000Z"),
  },
];

export const demonstrationReferralResponses: readonly ReferralResponseEvent[] = [];
