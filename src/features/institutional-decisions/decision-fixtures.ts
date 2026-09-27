/**
 * Etapa 13I — Catálogos e dados DEMONSTRATIVOS de decisão institucional.
 *
 * Nada aqui é norma homologada da Rede: são configurações de demonstração que
 * exercitam as capacidades do motor. Todos os identificadores são abertos.
 */
import type { StudentLifeProvenance } from "@/features/student-life/dossier-types";
import {
  FACT_AVAILABILITY,
  type AllowedOverride,
  type ConfigurationAuthority,
  type DecisionProcessTypeDefinition,
  type DelegatedConfigurationCapability,
  type InstitutionalCompetenceGrant,
  type InstitutionalDecisionProcess,
  type PolicyScope,
} from "./decision-types";
import { OVERRIDE_CONSTRAINT_EXECUTOR_IDS } from "./decision-engine";

// ------------------------------------------------------------- Identificadores

export const LEADERSHIP_DOMAIN_IDS = {
  institutionalDecision: "dominio-decisao-institucional-13i",
} as const;

export const LEADERSHIP_SCOPE_KINDS = {
  schoolUnit: "unidade-escolar",
  sector: "setor-institucional",
} as const;

/** Capacidades institucionais. Nenhuma delas é "ser diretor". */
export const LEADERSHIP_CAPACITIES = {
  consultInstitutionalState: "cap-consultar-estado-institucional-da-unidade",
  decideInstitutionalProcess: "cap-decidir-processo-institucional",
  authorizeException: "cap-autorizar-excecao-institucional",
  returnForCorrection: "cap-devolver-processo-para-correcao",
  readGuidanceRestrictedContent: "cap-ler-conteudo-restrito-de-acompanhamento",
  configureUnitParameter: "cap-configurar-parametro-da-unidade",
} as const;

export const LEADERSHIP_PURPOSES = {
  institutionalManagement: "finalidade-gestao-institucional-da-unidade",
} as const;

export const LEADERSHIP_OPERATIONS = {
  readInstitutionalMetadata: "operacao-ler-metadado-institucional",
  decide: "operacao-registrar-decisao-institucional",
  authorizeException: "operacao-autorizar-excecao",
  returnForCorrection: "operacao-devolver-para-correcao",
} as const;

export const LEADERSHIP_SENSITIVITY = {
  institutional: "sensibilidade-institucional",
  restricted: "sensibilidade-restrita",
} as const;

/**
 * Capacidade exigida para conhecer fatos de cada sensibilidade declarada.
 * Configuração demonstrativa: o motor e a apresentação não presumem nada quando
 * uma sensibilidade não está mapeada — nesse caso o fato não é projetado.
 */
export const FACT_SENSITIVITY_REQUIRED_CAPACITIES: Readonly<Record<string, string>> = {
  [LEADERSHIP_SENSITIVITY.restricted]: "cap-ler-conteudo-restrito-de-acompanhamento",
};

/** Política demonstrativa: a omissão genérica pode ser anunciada sem revelar o quê. */
export const LEADERSHIP_GENERIC_OMISSION_ALLOWED = true;

export const LEADERSHIP_PROCESS_TYPES = {
  institutionalDecision: "processo-decisao-institucional",
  closingImpediment: "processo-pendencia-de-encerramento",
  guidanceReferral: "processo-encaminhamento-recebido-da-orientacao",
} as const;

export const LEADERSHIP_SOURCE_TYPES = {
  decisionProcess: "processo-decisorio-13i",
  closingImpediment: "pendencia-de-encerramento-12k",
  guidanceReferral: "encaminhamento-13h",
} as const;

export const LEADERSHIP_ESCALATION_REASONS = {
  beyondSecretaryCompetence: "motivo-excede-competencia-da-secretaria",
  requiresInstitutionalAct: "motivo-exige-ato-institucional-da-unidade",
  returnedForCorrection: "motivo-devolvido-para-correcao",
} as const;

export const LEADERSHIP_ACT_NATURES = {
  exceptionalAuthorization: "ato-autorizacao-excepcional",
  institutionalDetermination: "ato-determinacao-institucional",
} as const;

export const LEADERSHIP_EFFECTS = {
  allowOperationForCase: "efeito-liberar-operacao-no-caso-concreto",
  registerRefusal: "efeito-registrar-indeferimento",
  returnToOrigin: "efeito-devolver-ao-setor-de-origem",
} as const;

export const LEADERSHIP_AWAITING_PARTIES = {
  leadership: "aguardando-direcao-escolar",
  secretary: "aguardando-secretaria-escolar",
  guidance: "aguardando-orientacao-pedagogica",
  superiorAuthority: "aguardando-autoridade-superior",
} as const;

export const LEADERSHIP_LINK_TARGETS = {
  studentProfile: "abrir-ficha-do-estudante",
  classClosing: "abrir-encerramento-da-turma",
} as const;

const provenance = (recordedAt: string): StudentLifeProvenance => ({
  originTypeId: "registro-demonstrativo-13i",
  recordedAt,
  recordedByAgentId: "agente-demonstrativo",
});

// ---------------------------------------------- Concessões de competência

/**
 * Dois agentes com o MESMO rótulo de cargo e capacidades diferentes; um terceiro
 * com competência apenas em outra unidade; e uma substituição temporária.
 */
export const demonstrationCompetenceGrants: readonly InstitutionalCompetenceGrant[] = [
  {
    grantId: "concessao-001",
    agentId: "agente-direcao-a",
    capacityDefinitionId: LEADERSHIP_CAPACITIES.consultInstitutionalState,
    scopeEntities: [
      { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
    validFrom: "2027-01-01",
    validUntil: null,
    positionLabelSnapshot: "Diretor escolar",
    provenance: provenance("2027-01-02T10:00:00.000Z"),
  },
  {
    grantId: "concessao-002",
    agentId: "agente-direcao-a",
    capacityDefinitionId: LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
    scopeEntities: [
      { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
    validFrom: "2027-01-01",
    validUntil: null,
    positionLabelSnapshot: "Diretor escolar",
    provenance: provenance("2027-01-02T10:00:00.000Z"),
  },
  {
    grantId: "concessao-003",
    agentId: "agente-direcao-a",
    capacityDefinitionId: LEADERSHIP_CAPACITIES.authorizeException,
    scopeEntities: [
      { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
    /** Vigência encerrada: decisões tomadas antes seguem válidas e explicáveis. */
    validFrom: "2027-01-01",
    validUntil: "2027-04-30",
    positionLabelSnapshot: "Diretor escolar",
    provenance: provenance("2027-01-02T10:00:00.000Z"),
  },
  {
    grantId: "concessao-004",
    agentId: "agente-direcao-b",
    capacityDefinitionId: LEADERSHIP_CAPACITIES.consultInstitutionalState,
    scopeEntities: [
      { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
    validFrom: "2027-01-01",
    validUntil: null,
    /** Mesmo cargo do agente A, SEM capacidade de decidir. */
    positionLabelSnapshot: "Diretor escolar",
    provenance: provenance("2027-01-02T10:00:00.000Z"),
  },
  {
    grantId: "concessao-005",
    agentId: "agente-direcao-c",
    capacityDefinitionId: LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
    scopeEntities: [
      { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-002" },
    ],
    validFrom: "2027-01-01",
    validUntil: null,
    positionLabelSnapshot: "Diretor escolar",
    provenance: provenance("2027-01-02T10:00:00.000Z"),
  },
  {
    grantId: "concessao-006",
    agentId: "agente-substituto-d",
    capacityDefinitionId: LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
    scopeEntities: [
      { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
    /** Substituição temporária: capacidade + vigência, sem trocar regras. */
    validFrom: "2027-05-05",
    validUntil: "2027-05-20",
    positionLabelSnapshot: "Respondendo pela direção",
    delegationOfGrantId: "concessao-002",
    provenance: provenance("2027-05-04T10:00:00.000Z"),
  },
  {
    grantId: "concessao-007",
    agentId: "agente-direcao-a",
    capacityDefinitionId: LEADERSHIP_CAPACITIES.configureUnitParameter,
    scopeEntities: [
      { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
    validFrom: "2027-01-01",
    validUntil: null,
    provenance: provenance("2027-01-02T10:00:00.000Z"),
  },
];

// ------------------------------------------- Tipos de processo decisório

export const exceptionalEnrollmentDecisionType: DecisionProcessTypeDefinition = {
  decisionProcessTypeDefinitionId: "tipo-decisao-excecao-de-inscricao-demo",
  labelSnapshot: "Autorização excepcional de inscrição letiva",
  descriptionSnapshot:
    "A configuração da inscrição declarou requisito não atendido e remeteu o caso a decisão institucional da unidade.",
  requiringPolicyId: "pol-requisitos-de-inscricao-demo",
  requiringPolicyVersion: 2,
  requirementNarrativeSnapshot:
    "A política de requisitos da inscrição letiva declara que o requisito não atendido só pode ser superado por decisão institucional fundamentada da unidade.",
  alternatives: [
    {
      alternativeDefinitionId: "alternativa-autorizar-excepcionalmente",
      labelSnapshot: "Autorizar excepcionalmente, com fundamentação",
      requiredCapacityDefinitionIds: [LEADERSHIP_CAPACITIES.authorizeException],
      effects: [
        {
          effectDefinitionId: LEADERSHIP_EFFECTS.allowOperationForCase,
          executorId: "executor-liberar-operacao-no-caso",
          labelSnapshot: "Libera a operação apenas neste caso concreto",
        },
      ],
    },
    {
      alternativeDefinitionId: "alternativa-indeferir",
      labelSnapshot: "Indeferir o pedido, com fundamentação",
      requiredCapacityDefinitionIds: [LEADERSHIP_CAPACITIES.decideInstitutionalProcess],
      effects: [
        {
          effectDefinitionId: LEADERSHIP_EFFECTS.registerRefusal,
          executorId: "executor-registrar-indeferimento",
          labelSnapshot:
            "Registra o indeferimento do pedido e mantém a situação atual do caso",
        },
      ],
    },
    {
      alternativeDefinitionId: "alternativa-devolver-para-correcao",
      labelSnapshot: "Devolver ao setor de origem para correção",
      requiredCapacityDefinitionIds: [LEADERSHIP_CAPACITIES.returnForCorrection],
      effects: [
        {
          effectDefinitionId: LEADERSHIP_EFFECTS.returnToOrigin,
          executorId: "executor-devolver-ao-setor-de-origem",
          labelSnapshot:
            "Devolve o assunto ao setor de origem, com a pendência apontada",
        },
      ],
    },
  ],
  actNatureDefinitionId: LEADERSHIP_ACT_NATURES.exceptionalAuthorization,
  requiresJustification: true,
  homologated: true,
  validFrom: "2027-01-01",
  validUntil: null,
};

/**
 * Processo que EXIGE decisão mas não admite nenhuma alternativa até que o fato
 * declarado seja apresentado.
 */
export const documentDependentDecisionType: DecisionProcessTypeDefinition = {
  decisionProcessTypeDefinitionId: "tipo-decisao-dependente-de-documento-demo",
  labelSnapshot: "Decisão dependente de documento comprobatório",
  requiringPolicyId: "pol-comprovacao-documental-demo",
  requiringPolicyVersion: 1,
  requirementNarrativeSnapshot:
    "A política exige decisão da unidade, porém condiciona qualquer alternativa à apresentação do documento comprobatório declarado.",
  alternatives: [
    {
      alternativeDefinitionId: "alternativa-deferir-com-documento",
      labelSnapshot: "Deferir com base no documento apresentado",
      requiredCapacityDefinitionIds: [LEADERSHIP_CAPACITIES.decideInstitutionalProcess],
      requiredFactKeys: ["fato-documento-comprobatorio"],
      effects: [
        {
          effectDefinitionId: LEADERSHIP_EFFECTS.allowOperationForCase,
          executorId: "executor-liberar-operacao-no-caso",
          labelSnapshot: "Libera a operação apenas neste caso concreto",
        },
      ],
    },
  ],
  actNatureDefinitionId: LEADERSHIP_ACT_NATURES.institutionalDetermination,
  requiresJustification: true,
  homologated: true,
  validFrom: "2027-01-01",
  validUntil: null,
};

export const demonstrationDecisionProcessTypes: readonly DecisionProcessTypeDefinition[] =
  [exceptionalEnrollmentDecisionType, documentDependentDecisionType];

// --------------------------------------------------- Processos decisórios

export const demonstrationDecisionProcesses: readonly InstitutionalDecisionProcess[] = [
  {
    decisionProcessId: "processo-decisao-001",
    decisionProcessTypeDefinitionId:
      exceptionalEnrollmentDecisionType.decisionProcessTypeDefinitionId,
    objectReferences: [
      {
        entityKindDefinitionId: "inscricao-letiva",
        entityId: "insc-demo-001",
        labelSnapshot: "Inscrição letiva demonstrativa insc-demo-001",
      },
    ],
    consideredFacts: [
      {
        factKey: "fato-requisito-nao-atendido",
        sourceTypeDefinitionId: "requisito-de-inscricao-13b",
        entityId: "req-demo-001",
        labelSnapshot: "Requisito da inscrição declarado não atendido",
        valueSnapshot: "Não atendido, conforme registro da Secretaria da escola",
        availability: FACT_AVAILABILITY.available,
      },
      {
        factKey: "fato-frequencia-oficial-do-ciclo",
        sourceTypeDefinitionId: "fechamento-oficial-de-frequencia-12h1",
        entityId: "freq-demo-001",
        labelSnapshot: "Frequência oficial consolidada do ciclo",
        valueSnapshot: null,
        availability: FACT_AVAILABILITY.unavailable,
        unavailabilityReasonSnapshot:
          "o fechamento oficial de frequência do ciclo ainda não foi homologado",
      },
    ],
    scopeEntities: [
      { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
    subjectReferences: [
      {
        subjectRoleDefinitionId: "papel-titular",
        reference: { entityKindDefinitionId: "aluno", entityId: "alu-001" },
      },
    ],
    escalationReasonDefinitionId:
      LEADERSHIP_ESCALATION_REASONS.beyondSecretaryCompetence,
    escalationNarrativeSnapshot:
      "A Secretaria registrou o requisito como não atendido e a política declara que apenas decisão institucional fundamentada pode superá-lo.",
    openedOn: "2027-04-12",
    deadline: {
      dueDate: "2027-04-30",
      deadlineOriginTypeDefinitionId: "prazo-declarado-na-politica",
    },
    sensitivityLevelDefinitionId: LEADERSHIP_SENSITIVITY.institutional,
    projectableFieldPaths: ["objeto", "motivo", "fatos", "regra"],
    provenance: provenance("2027-04-12T13:00:00.000Z"),
  },
  {
    decisionProcessId: "processo-decisao-002",
    decisionProcessTypeDefinitionId:
      documentDependentDecisionType.decisionProcessTypeDefinitionId,
    objectReferences: [
      {
        entityKindDefinitionId: "aluno",
        entityId: "alu-002",
        labelSnapshot: "Estudante demonstrativo alu-002",
      },
    ],
    consideredFacts: [
      {
        factKey: "fato-solicitacao-registrada",
        sourceTypeDefinitionId: "requerimento-institucional",
        entityId: "req-demo-002",
        labelSnapshot: "Requerimento registrado pela família",
        valueSnapshot: "Registrado na Secretaria da escola",
        availability: FACT_AVAILABILITY.available,
      },
      {
        factKey: "fato-documento-comprobatorio",
        sourceTypeDefinitionId: "documento-institucional-13f",
        entityId: "doc-demo-002",
        labelSnapshot: "Documento comprobatório exigido pela política",
        valueSnapshot: null,
        availability: FACT_AVAILABILITY.unavailable,
        unavailabilityReasonSnapshot:
          "o documento declarado pela política ainda não foi apresentado à unidade",
        absenceRevealable: true,
      },
      {
        factKey: "fato-registro-restrito-de-acompanhamento",
        sourceTypeDefinitionId: "registro-de-acompanhamento-13h",
        entityId: "acomp-demo-002",
        labelSnapshot: "Registro restrito de acompanhamento pedagógico",
        valueSnapshot: "Conteúdo restrito demonstrativo do acompanhamento",
        availability: FACT_AVAILABILITY.available,
        sensitivityLevelDefinitionId: LEADERSHIP_SENSITIVITY.restricted,
      },
    ],
    scopeEntities: [
      { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
    subjectReferences: [
      {
        subjectRoleDefinitionId: "papel-titular",
        reference: { entityKindDefinitionId: "aluno", entityId: "alu-002" },
      },
    ],
    escalationReasonDefinitionId:
      LEADERSHIP_ESCALATION_REASONS.requiresInstitutionalAct,
    escalationNarrativeSnapshot:
      "O requerimento exige ato institucional da unidade, mas o documento comprobatório declarado pela política ainda não foi apresentado.",
    openedOn: "2027-05-02",
    sensitivityLevelDefinitionId: LEADERSHIP_SENSITIVITY.institutional,
    projectableFieldPaths: ["objeto", "motivo", "fatos", "regra"],
    provenance: provenance("2027-05-02T13:00:00.000Z"),
  },
];

// ------------------------------------- Pendências de encerramento (12K/12H.1)

export type LeadershipClosingImpediment = {
  impedimentId: string;
  classId: string;
  classLabelSnapshot: string;
  unitId: string;
  requirementDefinitionId: string;
  messageSnapshot: string;
  effectDefinitionId: string;
  policyId: string;
  policyVersion: number;
  competentExecutorDefinitionId: string;
  inconclusive: boolean;
  effectiveDate: string;
  recordedAt: string;
};

export const demonstrationClosingImpediments: readonly LeadershipClosingImpediment[] = [
  {
    impedimentId: "impedimento-001",
    classId: "tur-001",
    classLabelSnapshot: "Turma demonstrativa tur-001",
    unitId: "demo-001",
    requirementDefinitionId: "req-situacao-academica-terminal",
    messageSnapshot:
      "Há participações sem situação acadêmica produzida por regra homologada: o encerramento não conclui.",
    effectDefinitionId: "efeito-impede-encerramento",
    policyId: "pol-encerramento-demo",
    policyVersion: 1,
    competentExecutorDefinitionId: "executor-colegiado-competente",
    inconclusive: false,
    effectiveDate: "2027-05-08",
    recordedAt: "2027-05-08T12:00:00.000Z",
  },
  {
    impedimentId: "impedimento-002",
    classId: "tur-002",
    classLabelSnapshot: "Turma demonstrativa tur-002",
    unitId: "demo-001",
    requirementDefinitionId: "req-fechamento-de-frequencia",
    messageSnapshot:
      "O fechamento de frequência permanece inconclusivo: sem política de apuração homologada nada é presumido.",
    effectDefinitionId: "efeito-inconclusivo",
    policyId: "pol-frequencia-demo",
    policyVersion: 1,
    competentExecutorDefinitionId: "executor-secretaria-escolar",
    inconclusive: true,
    effectiveDate: "2027-05-09",
    recordedAt: "2027-05-09T12:00:00.000Z",
  },
  {
    impedimentId: "impedimento-003",
    classId: "tur-003",
    classLabelSnapshot: "Turma demonstrativa tur-003",
    unitId: "demo-001",
    requirementDefinitionId: "req-entrega-de-diario",
    messageSnapshot:
      "Registros de aula pendentes de conferência impedem o encerramento da turma.",
    effectDefinitionId: "efeito-impede-encerramento",
    policyId: "pol-encerramento-demo",
    policyVersion: 1,
    competentExecutorDefinitionId: "executor-secretaria-escolar",
    inconclusive: false,
    effectiveDate: "2027-05-09",
    recordedAt: "2027-05-09T12:00:00.000Z",
  },
];

// ------------------------- Encaminhamento confidencial recebido da Orientação

export type LeadershipGuidanceReferral = {
  referralId: string;
  caseId: string;
  unitId: string;
  studentId: string;
  /** Texto pedagógico confidencial: NÃO deve aparecer para a Direção. */
  confidentialContentSnapshot: string;
  administrativeRequestSnapshot: string;
  issuedAt: string;
  recordedAt: string;
  sensitivityLevelDefinitionId: string;
};

export const demonstrationGuidanceReferralsToLeadership: readonly LeadershipGuidanceReferral[] =
  [
    {
      referralId: "enc-direcao-001",
      caseId: "caso-demo-001",
      unitId: "demo-001",
      studentId: "alu-001",
      confidentialContentSnapshot:
        "Conteúdo pedagógico confidencial do acompanhamento, acessível apenas a quem possui a capacidade específica.",
      administrativeRequestSnapshot:
        "Solicita providência administrativa da unidade quanto à organização de horário de atendimento.",
      issuedAt: "2027-05-06",
      recordedAt: "2027-05-06T14:00:00.000Z",
      sensitivityLevelDefinitionId: LEADERSHIP_SENSITIVITY.restricted,
    },
  ];

// ------------------------------------------- Governança local de configuração

export const demonstrationAuthorities: readonly ConfigurationAuthority[] = [
  {
    authorityId: "autoridade-rede",
    labelSnapshot: "Secretaria Municipal de Educação",
    authorityLevelDefinitionId: "nivel-rede-municipal",
    scopeEntities: [
      { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.sector, entityId: "setor-sme" },
    ],
  },
  {
    authorityId: "autoridade-unidade-demo-001",
    labelSnapshot: "Unidade escolar demonstrativa demo-001",
    authorityLevelDefinitionId: "nivel-unidade-escolar",
    scopeEntities: [
      { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
  },
];

export const demonstrationPolicyScopes: readonly PolicyScope[] = [
  {
    policyScopeId: "ambito-regra-de-situacao-academica",
    configurationSubjectDefinitionId: "regra-de-situacao-academica",
    labelSnapshot: "Regra de situação acadêmica",
    owningAuthorityId: "autoridade-rede",
    mutabilityDefinitionId: "imutavel-pela-unidade",
  },
  {
    policyScopeId: "ambito-janela-de-atencao-operacional",
    configurationSubjectDefinitionId: "janela-de-atencao-operacional",
    labelSnapshot: "Janela de atenção a prazos do portal",
    owningAuthorityId: "autoridade-rede",
    mutabilityDefinitionId: "parametrizavel-pela-unidade-dentro-de-limites",
  },
  {
    policyScopeId: "ambito-horario-de-atendimento-da-unidade",
    configurationSubjectDefinitionId: "horario-de-atendimento",
    labelSnapshot: "Horário de atendimento da secretaria da unidade",
    owningAuthorityId: "autoridade-unidade-demo-001",
    mutabilityDefinitionId: "inteiramente-local",
  },
];

export const demonstrationAllowedOverrides: readonly AllowedOverride[] = [
  {
    allowedOverrideId: "override-janela-de-atencao",
    policyScopeId: "ambito-janela-de-atencao-operacional",
    parameterDefinitionId: "parametro-dias-da-janela",
    labelSnapshot: "Dias da janela de atenção a prazos",
    constraints: [
      {
        constraintExecutorId: OVERRIDE_CONSTRAINT_EXECUTOR_IDS.numberWithinRange,
        parameters: { minimum: 5, maximum: 30 },
        messageSnapshot:
          "A Rede declarou que a unidade pode ajustar a janela apenas entre 5 e 30 dias.",
      },
    ],
    requiresSuperiorHomologation: false,
  },
  {
    allowedOverrideId: "override-horario-de-atendimento",
    policyScopeId: "ambito-horario-de-atendimento-da-unidade",
    parameterDefinitionId: "parametro-turno-de-atendimento",
    labelSnapshot: "Turno de atendimento ao público",
    constraints: [
      {
        constraintExecutorId: OVERRIDE_CONSTRAINT_EXECUTOR_IDS.valueInSet,
        parameters: { allowedValues: ["manha", "tarde", "integral"] },
      },
    ],
    requiresSuperiorHomologation: true,
  },
];

export const demonstrationConfigurationDelegations: readonly DelegatedConfigurationCapability[] =
  [
    {
      delegationId: "delegacao-001",
      policyScopeId: "ambito-janela-de-atencao-operacional",
      capacityDefinitionId: LEADERSHIP_CAPACITIES.configureUnitParameter,
      scopeEntities: [
        { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
      ],
      validFrom: "2027-01-01",
      validUntil: null,
    },
    {
      delegationId: "delegacao-002",
      policyScopeId: "ambito-horario-de-atendimento-da-unidade",
      capacityDefinitionId: LEADERSHIP_CAPACITIES.configureUnitParameter,
      scopeEntities: [
        { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
      ],
      validFrom: "2027-01-01",
      validUntil: null,
    },
  ];
