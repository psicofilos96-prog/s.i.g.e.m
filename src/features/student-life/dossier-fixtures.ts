/**
 * Etapa 13F — Fixtures DEMONSTRATIVAS. Nenhuma delas é norma da rede.
 *
 * Todos os identificadores abaixo são exemplos de CONFIGURAÇÃO: tipos de
 * registro, tipos documentais, estados, sensibilidade, finalidades, operações,
 * efeitos de acesso e consequências de ciclo de vida podem ser substituídos sem
 * qualquer alteração de código.
 */
import type {
  AnalyticalExposurePolicy,
} from "./dossier-analytics";
import { DOSSIER_ACCESS_EXECUTOR_IDS } from "./dossier-access";
import {
  LIFECYCLE_ANCHOR_IDS,
  LIFECYCLE_EXECUTOR_IDS,
} from "./dossier-lifecycle";
import { DOSSIER_RESOURCE_KIND_IDS } from "./dossier-records";
import type {
  DigitalAssetReference,
  DocumentRecord,
  DocumentRepresentation,
  DossierAccessPolicy,
  DossierRecord,
  DossierRelation,
  LifecyclePolicy,
  PersonalRelationshipRecord,
  StudentLifeProvenance,
  StudentResponsibilityAssignment,
} from "./dossier-types";

export const DEMO_DOSSIER_SENSITIVITY_IDS = {
  institutional: "publico-institucional",
  restricted: "restrito-orientacao",
  confidential: "sigiloso-direcao-supervisao",
} as const;

export const DEMO_DOSSIER_RECORD_TYPE_IDS = {
  attendanceJustification: "ocorrencia-justificativa-de-frequencia",
  pedagogicalNote: "anotacao-orientacao-pedagogica",
  recognizedHealthFact: "fato-institucional-reconhecido-de-saude",
} as const;

export const DEMO_DOCUMENT_TYPE_IDS = {
  birthCertificate: "certidao-de-nascimento",
  medicalCertificate: "atestado-medico",
  guardianshipTerm: "termo-de-guarda",
  multiprofessionalReport: "laudo-multiprofissional",
} as const;

export const DEMO_DOCUMENT_STATUS_IDS = {
  received: "recebido",
  authenticated: "autenticado",
  archived: "arquivado",
} as const;

export const DEMO_DOCUMENT_VERIFICATION_IDS = {
  pending: "conferencia-pendente",
  verified: "conferido",
} as const;

export const DEMO_REPRESENTATION_KIND_IDS = {
  original: "via-original",
  scan: "digitalizacao",
  authenticatedCopy: "via-autenticada",
} as const;

export const DEMO_SUBJECT_ROLE_IDS = {
  holder: "titular",
  involved: "envolvido",
  responsible: "responsavel-referido",
} as const;

export const DEMO_RELATION_TYPE_IDS = {
  grounds: "fundamenta",
  complements: "complementa",
  rectifies: "retifica",
  proves: "comprova",
} as const;

export const DEMO_RELATIONSHIP_ROLE_IDS = {
  mother: "mae",
  grandmother: "avo",
  fosterFamily: "familia-acolhedora",
  institutionalRepresentative: "representante-institucional",
} as const;

export const DEMO_RESPONSIBILITY_CAPACITY_IDS = {
  signEnrollment: "assinatura-de-matricula",
  authorizeExit: "autorizacao-de-saida",
  receiveCommunications: "recebimento-de-comunicados",
} as const;

export const DEMO_ACCESS_CAPACITY_IDS = {
  secretariat: "capacidade-secretaria-escolar",
  guidance: "capacidade-orientacao-educacional",
  management: "capacidade-direcao-escolar",
  supervision: "capacidade-supervisao-da-rede",
  teacher: "capacidade-docente",
} as const;

export const DEMO_ACCESS_OPERATION_IDS = {
  readMetadata: "consultar-metadados",
  readContent: "visualizar-conteudo",
  obtainRepresentation: "obter-representacao-documental",
} as const;

export const DEMO_PROCESSING_PURPOSE_IDS = {
  schoolManagement: "gestao-da-vida-escolar",
  pedagogicalFollowUp: "acompanhamento-pedagogico",
  networkSupervision: "supervisao-normativa-da-rede",
} as const;

export const DEMO_ACCESS_EFFECT_IDS = {
  granted: "permitido",
  denied: "negado",
  grantedWithAudit: "permitido-com-auditoria",
  partial: "permitido-parcialmente",
  requiresJustification: "exige-justificativa",
} as const;

export const DEMO_LIFECYCLE_CONSEQUENCE_IDS = {
  archive: "arquivar",
  review: "submeter-a-revisao",
  restrictAccess: "restringir-acesso",
  preservePermanently: "preservar-permanentemente",
} as const;

export const DEMO_ABSENCE_REASON_IDS = {
  notInformed: "nao-informado",
} as const;

const provenance = (
  recordedAt: string,
  agentId: string,
  extra?: Partial<StudentLifeProvenance>,
): StudentLifeProvenance => ({
  originTypeId: "atendimento-presencial",
  recordedAt,
  recordedByAgentId: agentId,
  ...extra,
});

export const DEMO_STUDENT_ID = "aluno-demo-001";
export const DEMO_SIBLING_STUDENT_ID = "aluno-demo-002";
export const DEMO_UNIT_ID = "unidade-demo-001";

const unitScope = [
  { entityKindDefinitionId: "unidade-escolar", entityId: DEMO_UNIT_ID },
] as const;

const studentSubject = (
  studentId: string,
  roleId: string = DEMO_SUBJECT_ROLE_IDS.holder,
) => ({
  subjectRoleDefinitionId: roleId,
  reference: { entityKindDefinitionId: "aluno", entityId: studentId },
});

/** Registro do prontuário com dois alunos envolvidos no mesmo acontecimento. */
export const DEMO_MULTI_STUDENT_RECORD: DossierRecord = {
  recordId: "registro-demo-001",
  recordTypeDefinitionId: DEMO_DOSSIER_RECORD_TYPE_IDS.pedagogicalNote,
  sensitivityLevelDefinitionId: DEMO_DOSSIER_SENSITIVITY_IDS.restricted,
  subjectReferences: [
    studentSubject(DEMO_STUDENT_ID),
    studentSubject(DEMO_SIBLING_STUDENT_ID, DEMO_SUBJECT_ROLE_IDS.involved),
  ],
  scopeEntities: unitScope,
  effectiveDate: "2026-03-10",
  structuredPayload: {
    resumo: "Atendimento conjunto de orientação registrado pela equipe.",
    detalhe: "Encaminhamento pedagógico acordado com a família.",
  },
  supplementaryText: "Registro de leitura humana, sem efeito normativo.",
  provenance: provenance("2026-03-10T14:05:00Z", "agente-demo-orientacao"),
};

export const DEMO_CONFIDENTIAL_RECORD: DossierRecord = {
  recordId: "registro-demo-002",
  recordTypeDefinitionId: DEMO_DOSSIER_RECORD_TYPE_IDS.recognizedHealthFact,
  sensitivityLevelDefinitionId: DEMO_DOSSIER_SENSITIVITY_IDS.confidential,
  subjectReferences: [studentSubject(DEMO_STUDENT_ID)],
  scopeEntities: unitScope,
  effectiveDate: "2026-04-02",
  structuredPayload: {
    resumo: "Fato institucional reconhecido a partir de laudo apresentado.",
    conteudoSensivel: "Conteúdo clínico restrito descrito no laudo.",
  },
  provenance: provenance("2026-04-02T10:00:00Z", "agente-demo-direcao"),
};

export const DEMO_ATTENDANCE_RECORD: DossierRecord = {
  recordId: "registro-demo-003",
  recordTypeDefinitionId:
    DEMO_DOSSIER_RECORD_TYPE_IDS.attendanceJustification,
  sensitivityLevelDefinitionId: DEMO_DOSSIER_SENSITIVITY_IDS.institutional,
  subjectReferences: [studentSubject(DEMO_STUDENT_ID)],
  scopeEntities: unitScope,
  effectiveDate: "2026-05-18",
  structuredPayload: {
    resumo: "Justificativa de ausência apresentada à secretaria.",
  },
  provenance: provenance("2026-05-18T09:30:00Z", "agente-demo-secretaria"),
};

/** Retificação retrospectiva do registro 003, preservando a versão anterior. */
export const DEMO_ATTENDANCE_RECORD_CORRECTION: DossierRecord = {
  ...DEMO_ATTENDANCE_RECORD,
  recordId: "registro-demo-004",
  structuredPayload: {
    resumo: "Justificativa de ausência retificada quanto ao período.",
  },
  supersedesRecordId: DEMO_ATTENDANCE_RECORD.recordId,
  provenance: provenance("2026-05-20T11:00:00Z", "agente-demo-secretaria", {
    supersedesId: DEMO_ATTENDANCE_RECORD.recordId,
    correctionReasonDefinitionId: "erro-material",
  }),
};

/** Documento multi-entidade: aluno, responsável e processo simultaneamente. */
export const DEMO_MULTI_SUBJECT_DOCUMENT: DocumentRecord = {
  documentRecordId: "documento-demo-001",
  documentTypeDefinitionId: DEMO_DOCUMENT_TYPE_IDS.guardianshipTerm,
  documentIdentifier: "TG-2026-0042",
  issuerReference: {
    entityKindDefinitionId: "entidade-externa",
    entityId: "vara-da-infancia-demo",
  },
  issuanceDate: "2026-02-01",
  documentStatusDefinitionId: DEMO_DOCUMENT_STATUS_IDS.authenticated,
  verificationStatusDefinitionId: DEMO_DOCUMENT_VERIFICATION_IDS.verified,
  sensitivityLevelDefinitionId: DEMO_DOSSIER_SENSITIVITY_IDS.restricted,
  subjectReferences: [
    studentSubject(DEMO_STUDENT_ID),
    {
      subjectRoleDefinitionId: DEMO_SUBJECT_ROLE_IDS.responsible,
      reference: { entityKindDefinitionId: "pessoa", entityId: "pessoa-demo-avo" },
    },
    {
      subjectRoleDefinitionId: DEMO_SUBJECT_ROLE_IDS.involved,
      reference: {
        entityKindDefinitionId: "processo-institucional",
        entityId: "processo-demo-guarda",
      },
    },
  ],
  scopeEntities: unitScope,
  provenance: provenance("2026-02-03T08:00:00Z", "agente-demo-secretaria"),
};

export const DEMO_BIRTH_CERTIFICATE: DocumentRecord = {
  documentRecordId: "documento-demo-002",
  documentTypeDefinitionId: DEMO_DOCUMENT_TYPE_IDS.birthCertificate,
  documentIdentifier: "CN-9988",
  issuanceDate: "2015-07-14",
  documentStatusDefinitionId: DEMO_DOCUMENT_STATUS_IDS.received,
  verificationStatusDefinitionId: DEMO_DOCUMENT_VERIFICATION_IDS.pending,
  sensitivityLevelDefinitionId: DEMO_DOSSIER_SENSITIVITY_IDS.institutional,
  subjectReferences: [studentSubject(DEMO_STUDENT_ID)],
  scopeEntities: unitScope,
  provenance: provenance("2026-01-20T13:00:00Z", "agente-demo-secretaria"),
};

export const DEMO_REPORT_DOCUMENT: DocumentRecord = {
  documentRecordId: "documento-demo-003",
  documentTypeDefinitionId: DEMO_DOCUMENT_TYPE_IDS.multiprofessionalReport,
  issuanceDate: "2026-03-28",
  documentStatusDefinitionId: DEMO_DOCUMENT_STATUS_IDS.received,
  sensitivityLevelDefinitionId: DEMO_DOSSIER_SENSITIVITY_IDS.confidential,
  subjectReferences: [studentSubject(DEMO_STUDENT_ID)],
  scopeEntities: unitScope,
  provenance: provenance("2026-03-30T16:20:00Z", "agente-demo-direcao"),
};

export const DEMO_DIGITAL_ASSETS: readonly DigitalAssetReference[] = [
  {
    assetId: "ativo-demo-001",
    mediaTypeDefinitionId: "documento-pdf",
    storageUri: "demo://dossier/documento-demo-001/original.pdf",
    integrity: { algorithmDefinitionId: "sha-256", digest: "demo-digest-001" },
    provenance: provenance("2026-02-03T08:01:00Z", "agente-demo-secretaria"),
  },
  {
    assetId: "ativo-demo-002",
    mediaTypeDefinitionId: "imagem-digitalizada",
    storageUri: "demo://dossier/documento-demo-001/digitalizacao.png",
    provenance: provenance("2026-02-03T08:02:00Z", "agente-demo-secretaria"),
  },
];

/** O MESMO documento com duas representações — nunca dois documentos. */
export const DEMO_DOCUMENT_REPRESENTATIONS: readonly DocumentRepresentation[] =
  [
    {
      representationId: "representacao-demo-001",
      documentRecordId: DEMO_MULTI_SUBJECT_DOCUMENT.documentRecordId,
      representationKindDefinitionId: DEMO_REPRESENTATION_KIND_IDS.original,
      assetId: "ativo-demo-001",
      provenance: provenance("2026-02-03T08:01:00Z", "agente-demo-secretaria"),
    },
    {
      representationId: "representacao-demo-002",
      documentRecordId: DEMO_MULTI_SUBJECT_DOCUMENT.documentRecordId,
      representationKindDefinitionId: DEMO_REPRESENTATION_KIND_IDS.scan,
      assetId: "ativo-demo-002",
      provenance: provenance("2026-02-03T08:02:00Z", "agente-demo-secretaria"),
    },
  ];

export const DEMO_DOSSIER_RELATIONS: readonly DossierRelation[] = [
  {
    relationId: "relacao-demo-001",
    relationTypeDefinitionId: DEMO_RELATION_TYPE_IDS.grounds,
    sourceReference: {
      entityKindDefinitionId: "registro-documental",
      entityId: DEMO_REPORT_DOCUMENT.documentRecordId,
    },
    targetReference: {
      entityKindDefinitionId: "registro-de-prontuario",
      entityId: DEMO_CONFIDENTIAL_RECORD.recordId,
    },
    provenance: provenance("2026-04-02T10:05:00Z", "agente-demo-direcao"),
  },
  {
    relationId: "relacao-demo-002",
    relationTypeDefinitionId: DEMO_RELATION_TYPE_IDS.rectifies,
    sourceReference: {
      entityKindDefinitionId: "registro-de-prontuario",
      entityId: DEMO_ATTENDANCE_RECORD_CORRECTION.recordId,
    },
    targetReference: {
      entityKindDefinitionId: "registro-de-prontuario",
      entityId: DEMO_ATTENDANCE_RECORD.recordId,
    },
    provenance: provenance("2026-05-20T11:01:00Z", "agente-demo-secretaria"),
  },
];

/** Avó com relação registrada; o poder de representação vem da atribuição. */
export const DEMO_PERSONAL_RELATIONSHIPS: readonly PersonalRelationshipRecord[] =
  [
    {
      relationshipId: "relacao-pessoal-demo-001",
      personId: "pessoa-demo-avo",
      relatedReference: {
        entityKindDefinitionId: "aluno",
        entityId: DEMO_STUDENT_ID,
      },
      relationshipRoleDefinitionId: DEMO_RELATIONSHIP_ROLE_IDS.grandmother,
      validFrom: "2015-07-14",
      validUntil: null,
      provenance: provenance("2026-01-20T13:05:00Z", "agente-demo-secretaria"),
    },
    {
      relationshipId: "relacao-pessoal-demo-002",
      personId: "pessoa-demo-mae",
      relatedReference: {
        entityKindDefinitionId: "aluno",
        entityId: DEMO_STUDENT_ID,
      },
      relationshipRoleDefinitionId: DEMO_RELATIONSHIP_ROLE_IDS.mother,
      validFrom: "2015-07-14",
      validUntil: null,
      provenance: provenance("2026-01-20T13:06:00Z", "agente-demo-secretaria"),
    },
  ];

export const DEMO_RESPONSIBILITY_ASSIGNMENTS: readonly StudentResponsibilityAssignment[] =
  [
    {
      assignmentId: "responsabilidade-demo-001",
      personId: "pessoa-demo-avo",
      subjectReference: {
        entityKindDefinitionId: "aluno",
        entityId: DEMO_STUDENT_ID,
      },
      responsibilityCapacityDefinitionIds: [
        DEMO_RESPONSIBILITY_CAPACITY_IDS.signEnrollment,
        DEMO_RESPONSIBILITY_CAPACITY_IDS.authorizeExit,
        DEMO_RESPONSIBILITY_CAPACITY_IDS.receiveCommunications,
      ],
      basisDefinitionId: "termo-de-guarda-homologado",
      basisDocumentRecordId: DEMO_MULTI_SUBJECT_DOCUMENT.documentRecordId,
      relationshipId: "relacao-pessoal-demo-001",
      validFrom: "2026-02-01",
      validUntil: null,
      provenance: provenance("2026-02-03T08:10:00Z", "agente-demo-secretaria"),
    },
    {
      assignmentId: "responsabilidade-demo-002",
      personId: "pessoa-demo-abrigo",
      subjectReference: {
        entityKindDefinitionId: "aluno",
        entityId: DEMO_SIBLING_STUDENT_ID,
      },
      responsibilityCapacityDefinitionIds: [
        DEMO_RESPONSIBILITY_CAPACITY_IDS.receiveCommunications,
      ],
      basisDefinitionId: "designacao-institucional",
      validFrom: "2026-02-01",
      validUntil: "2026-06-30",
      provenance: provenance("2026-02-03T08:12:00Z", "agente-demo-secretaria"),
    },
  ];

/** Política de acesso DEMONSTRATIVA — homologada apenas para demonstração. */
export const DEMO_DOSSIER_ACCESS_POLICY: DossierAccessPolicy = {
  policyId: "politica-acesso-dossie-demo",
  policyVersion: 1,
  validFrom: "2026-01-01",
  validUntil: null,
  homologated: true,
  accessEffectDefinitionIds: Object.values(DEMO_ACCESS_EFFECT_IDS),
  operationDefinitionIds: Object.values(DEMO_ACCESS_OPERATION_IDS),
  processingPurposeDefinitionIds: Object.values(DEMO_PROCESSING_PURPOSE_IDS),
  rules: [
    {
      ruleId: "regra-demo-sigiloso-direcao",
      priority: 10,
      match: {
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.management],
        sensitivityLevelDefinitionIds: [
          DEMO_DOSSIER_SENSITIVITY_IDS.confidential,
        ],
      },
      effect: {
        accessEffectDefinitionId: DEMO_ACCESS_EFFECT_IDS.grantedWithAudit,
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantWithAudit,
      },
      legalOrInstitutionalBasisReference: {
        entityKindDefinitionId: "ato-institucional",
        entityId: "ato-demo-competencia-direcao",
      },
    },
    {
      ruleId: "regra-demo-sigiloso-supervisao-condicionada",
      priority: 15,
      match: {
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.supervision],
        sensitivityLevelDefinitionIds: [
          DEMO_DOSSIER_SENSITIVITY_IDS.confidential,
        ],
      },
      effect: {
        accessEffectDefinitionId:
          DEMO_ACCESS_EFFECT_IDS.requiresJustification,
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.requireSatisfaction,
        parameters: {
          requirementDefinitionIds: ["justificativa-de-finalidade"],
        },
      },
    },
    {
      ruleId: "regra-demo-restrito-orientacao-parcial",
      priority: 20,
      match: {
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.guidance],
        sensitivityLevelDefinitionIds: [
          DEMO_DOSSIER_SENSITIVITY_IDS.restricted,
        ],
      },
      effect: {
        accessEffectDefinitionId: DEMO_ACCESS_EFFECT_IDS.partial,
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantFields,
        parameters: { fieldPaths: ["resumo", "tipo", "estado"] },
      },
    },
    {
      ruleId: "regra-demo-secretaria-institucional",
      priority: 30,
      match: {
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.secretariat],
        sensitivityLevelDefinitionIds: [
          DEMO_DOSSIER_SENSITIVITY_IDS.institutional,
          DEMO_DOSSIER_SENSITIVITY_IDS.restricted,
        ],
        requiresScopeIntersection: true,
      },
      effect: {
        accessEffectDefinitionId: DEMO_ACCESS_EFFECT_IDS.granted,
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantAll,
      },
    },
    {
      ruleId: "regra-demo-docente-institucional",
      priority: 40,
      match: {
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.teacher],
        sensitivityLevelDefinitionIds: [
          DEMO_DOSSIER_SENSITIVITY_IDS.institutional,
        ],
      },
      effect: {
        accessEffectDefinitionId: DEMO_ACCESS_EFFECT_IDS.granted,
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantAll,
      },
    },
  ],
  defaultEffect: {
    accessEffectDefinitionId: DEMO_ACCESS_EFFECT_IDS.denied,
    executorId: DOSSIER_ACCESS_EXECUTOR_IDS.withhold,
  },
};

/** Política de ciclo de vida transversal: documentos E registros. */
export const DEMO_LIFECYCLE_POLICY: LifecyclePolicy = {
  policyId: "politica-ciclo-de-vida-dossie-demo",
  policyVersion: 1,
  homologated: true,
  rules: [
    {
      ruleId: "regra-ciclo-demo-atestado",
      resourceKindDefinitionIds: [DOSSIER_RESOURCE_KIND_IDS.documentRecord],
      typeDefinitionIds: [DEMO_DOCUMENT_TYPE_IDS.medicalCertificate],
      anchorDefinitionId: LIFECYCLE_ANCHOR_IDS.effectiveDate,
      retentionDurationDays: 30,
      consequences: [
        {
          consequenceDefinitionId: DEMO_LIFECYCLE_CONSEQUENCE_IDS.archive,
          executorId: LIFECYCLE_EXECUTOR_IDS.propose,
        },
      ],
    },
    {
      ruleId: "regra-ciclo-demo-certidao",
      resourceKindDefinitionIds: [DOSSIER_RESOURCE_KIND_IDS.documentRecord],
      typeDefinitionIds: [DEMO_DOCUMENT_TYPE_IDS.birthCertificate],
      anchorDefinitionId: LIFECYCLE_ANCHOR_IDS.recordedAt,
      retentionDurationDays: 3650,
      consequences: [
        {
          consequenceDefinitionId:
            DEMO_LIFECYCLE_CONSEQUENCE_IDS.preservePermanently,
          executorId: LIFECYCLE_EXECUTOR_IDS.propose,
        },
      ],
    },
    {
      ruleId: "regra-ciclo-demo-anotacao-pedagogica",
      resourceKindDefinitionIds: [DOSSIER_RESOURCE_KIND_IDS.dossierRecord],
      typeDefinitionIds: [DEMO_DOSSIER_RECORD_TYPE_IDS.pedagogicalNote],
      anchorDefinitionId: LIFECYCLE_ANCHOR_IDS.effectiveDate,
      retentionDurationDays: 60,
      consequences: [
        {
          consequenceDefinitionId: DEMO_LIFECYCLE_CONSEQUENCE_IDS.review,
          executorId: LIFECYCLE_EXECUTOR_IDS.propose,
        },
        {
          consequenceDefinitionId:
            DEMO_LIFECYCLE_CONSEQUENCE_IDS.restrictAccess,
          executorId: LIFECYCLE_EXECUTOR_IDS.propose,
        },
      ],
    },
  ],
};

/** Exposição analítica: sigiloso não existe para o cubo; restrito é mínimo. */
export const DEMO_ANALYTICAL_EXPOSURE_POLICY: AnalyticalExposurePolicy = {
  policyId: "politica-exposicao-analitica-dossie-demo",
  policyVersion: 1,
  homologated: true,
  rules: [
    {
      ruleId: "exposicao-demo-institucional",
      resourceKindDefinitionIds: [
        DOSSIER_RESOURCE_KIND_IDS.dossierRecord,
        DOSSIER_RESOURCE_KIND_IDS.documentRecord,
      ],
      sensitivityLevelDefinitionIds: [
        DEMO_DOSSIER_SENSITIVITY_IDS.institutional,
      ],
      exposeExistence: true,
    },
    {
      ruleId: "exposicao-demo-restrito",
      resourceKindDefinitionIds: [
        DOSSIER_RESOURCE_KIND_IDS.dossierRecord,
        DOSSIER_RESOURCE_KIND_IDS.documentRecord,
      ],
      sensitivityLevelDefinitionIds: [DEMO_DOSSIER_SENSITIVITY_IDS.restricted],
      exposeExistence: true,
    },
  ],
};

export const DEMO_DOSSIER_RECORDS: readonly DossierRecord[] = [
  DEMO_MULTI_STUDENT_RECORD,
  DEMO_CONFIDENTIAL_RECORD,
  DEMO_ATTENDANCE_RECORD,
  DEMO_ATTENDANCE_RECORD_CORRECTION,
];

export const DEMO_DOCUMENT_RECORDS: readonly DocumentRecord[] = [
  DEMO_MULTI_SUBJECT_DOCUMENT,
  DEMO_BIRTH_CERTIFICATE,
  DEMO_REPORT_DOCUMENT,
];
