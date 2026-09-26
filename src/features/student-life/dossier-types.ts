/**
 * Etapa 13F — Dossiê e Prontuário Canônico do Aluno (contratos).
 *
 * PRINCÍPIO REITOR
 *   O dossiê NÃO é fonte de verdade de matrícula (13B), turma (13C), mobilidade
 *   (13D), continuidade (13E) nem resultado acadêmico (Cap. 12). Ele AGREGA,
 *   REFERENCIA e GOVERNA registros próprios do prontuário, objetos documentais,
 *   relações pessoais e responsabilidades — sempre por referência versionada.
 *
 * DISTINÇÕES RIGOROSAS (nenhuma produz a outra automaticamente)
 *   documento apresentado ≠ conteúdo do documento ≠ verificação do documento
 *   ≠ fato institucional reconhecido a partir dele.
 *   relação pessoal (parentesco/convivência) ≠ responsabilidade institucional.
 *   registro documental ≠ representação digital ≠ ativo digital (arquivo).
 *
 * REGRAS DO CONTRATO
 * - Nenhuma taxonomia fechada: tipos de registro, tipos documentais, estados,
 *   sensibilidade, papéis, finalidades, operações, efeitos de acesso e
 *   consequências de ciclo de vida são DEFINIÇÕES configuradas (IDs abertos).
 * - Nada derivável é persistido: superação histórica, pendência documental e
 *   contagens são projeções.
 * - Titularidade é PLURAL: registros e documentos podem referir-se a vários
 *   alunos, pessoas, processos, unidades e entidades externas.
 * - Datas trafegam em ISO internamente; DD/MM/AAAA é apresentação.
 * - Ausência permanece ausência: `null`/omissão nunca vira zero nem categoria.
 */
import type {
  InstitutionalActReference,
  InternalId,
  StudentLifeProvenance,
} from "./student-life-types";

export const STUDENT_DOSSIER_SCHEMA_VERSION = 1;
export const STUDENT_DOSSIER_MODULE_LABEL =
  "Dossiê e Prontuário Canônico do Aluno";

// --------------------------------------------------------------- Referências

/**
 * Referência aberta a QUALQUER entidade institucional. A natureza é declarada
 * por configuração (`entityKindDefinitionId`): aluno, pessoa, unidade, processo,
 * ato, inscrição, turma, entidade externa, decisão judicial…
 */
export type DossierEntityReference = {
  entityKindDefinitionId: string;
  entityId: string;
  /** Versão da entidade referenciada, quando o domínio de origem versiona. */
  entityVersion?: number;
  /** Rótulo congelado para leitura humana; nunca critério computável. */
  labelSnapshot?: string;
};

/**
 * Titularidade/vinculação de um recurso a uma entidade, com o PAPEL declarado
 * por configuração (titular, corresponsável, envolvido, referido, emissor…).
 */
export type DossierSubjectReference = {
  subjectRoleDefinitionId: string;
  reference: DossierEntityReference;
};

/** Período de referência temporal do fato, quando aplicável. */
export type DossierPeriod = {
  validFrom: string;
  validUntil: string | null;
};

// ------------------------------------------- Registro próprio do prontuário

/**
 * Registro cuja fonte institucional legítima é o próprio prontuário: ocorrência,
 * anotação, notificação, reconhecimento de fato a partir de documento etc.
 *
 * Não existe campo de "tipo fixo", não existe `studentId` único obrigatório e
 * não existe flag de superação: a cadeia `supersedesRecordId` é a verdade.
 */
export type DossierRecord = {
  recordId: InternalId;
  recordTypeDefinitionId: string;
  recordClassificationDefinitionId?: string;
  sensitivityLevelDefinitionId: string;
  /** Sujeitos do registro (um ou vários alunos/pessoas/entidades). */
  subjectReferences: readonly DossierSubjectReference[];
  /** Escopo institucional do registro (unidade, setor, colegiado…). */
  scopeEntities: readonly DossierEntityReference[];
  /** Quando o fato ocorreu no mundo real (ISO). */
  effectiveDate: string;
  /** Intervalo de referência do fato, quando ele não é pontual. */
  factPeriod?: DossierPeriod;
  /** Schema configurado que valida `structuredPayload`. */
  payloadSchemaDefinitionId?: string;
  structuredPayload: Readonly<Record<string, unknown>>;
  /** Texto complementar de leitura humana; nunca critério computável. */
  supplementaryText?: string;
  /** Retificação retrospectiva: aponta a versão anterior substituída. */
  supersedesRecordId?: InternalId;
  provenance: StudentLifeProvenance;
};

// ------------------------------------------- Documento, representação, ativo

/** Objeto documental institucional. NÃO contém o arquivo. */
export type DocumentRecord = {
  documentRecordId: InternalId;
  documentTypeDefinitionId: string;
  /** Número/protocolo exibível registrado no próprio documento. */
  documentIdentifier?: string;
  /** Emissor como referência institucional (interno ou externo). */
  issuerReference?: DossierEntityReference;
  issuanceDate?: string;
  /** Validade documental, quando o tipo a possuir. */
  validityPeriod?: DossierPeriod;
  documentStatusDefinitionId: string;
  verificationStatusDefinitionId?: string;
  sensitivityLevelDefinitionId: string;
  /** Titularidade plural: aluno, responsável, processo, unidade, terceiros… */
  subjectReferences: readonly DossierSubjectReference[];
  scopeEntities: readonly DossierEntityReference[];
  supersedesDocumentRecordId?: InternalId;
  provenance: StudentLifeProvenance;
};

/** Ativo digital: a representação em arquivo, com integridade verificável. */
export type DigitalAssetReference = {
  assetId: InternalId;
  /** Natureza técnica do ativo, declarada por configuração. */
  mediaTypeDefinitionId: string;
  /** URI lógica de armazenamento; o arquivo nunca é a verdade institucional. */
  storageUri: string;
  integrity?: { algorithmDefinitionId: string; digest: string };
  byteSize?: number;
  provenance: StudentLifeProvenance;
};

/** Relação N:M entre documento institucional e suas representações digitais. */
export type DocumentRepresentation = {
  representationId: InternalId;
  documentRecordId: InternalId;
  /** original, digitalização, via autenticada, representação estruturada… */
  representationKindDefinitionId: string;
  assetId: InternalId;
  /** Sensibilidade específica da representação, quando diferir do documento. */
  sensitivityLevelDefinitionId?: string;
  provenance: StudentLifeProvenance;
};

// ----------------------------------------------------- Relações entre recursos

/**
 * Relação ABERTA entre quaisquer recursos/entidades: fundamenta, complementa,
 * retifica, responde-a, decorre-de, comprova, contradiz, substitui, associa-se-a…
 * Nenhuma dessas naturezas vive no código.
 */
export type DossierRelation = {
  relationId: InternalId;
  relationTypeDefinitionId: string;
  sourceReference: DossierEntityReference;
  targetReference: DossierEntityReference;
  institutionalActReference?: InstitutionalActReference;
  provenance: StudentLifeProvenance;
};

// ------------------------------------- Relações pessoais e responsabilidades

/** Descreve a RELAÇÃO entre pessoas (ou pessoa e aluno). Não confere poder. */
export type PersonalRelationshipRecord = {
  relationshipId: InternalId;
  personId: InternalId;
  relatedReference: DossierEntityReference;
  /** mãe, pai, avó, irmã, família acolhedora, representante institucional… */
  relationshipRoleDefinitionId: string;
  validFrom: string;
  validUntil: string | null;
  provenance: StudentLifeProvenance;
};

/**
 * Descreve CAPACIDADES/responsabilidades institucionais atribuídas a uma pessoa
 * perante um aluno, com vigência, fundamento e ato/documento comprobatório.
 * Existe independentemente de haver relação de parentesco registrada.
 */
export type StudentResponsibilityAssignment = {
  assignmentId: InternalId;
  personId: InternalId;
  subjectReference: DossierEntityReference;
  /** Capacidades declaradas por configuração (nunca enum). */
  responsibilityCapacityDefinitionIds: readonly string[];
  /** Fundamento da atribuição (definição configurada). */
  basisDefinitionId?: string;
  /** Documento que a comprova, quando existir. */
  basisDocumentRecordId?: InternalId;
  institutionalActReference?: InstitutionalActReference;
  /** Relação pessoal associada, quando houver — opcional por princípio. */
  relationshipId?: InternalId;
  validFrom: string;
  validUntil: string | null;
  provenance: StudentLifeProvenance;
};

// --------------------------------------------------- Governança de acesso

/** Fatos do pedido de acesso. Nenhum deles é inferido pelo motor. */
export type AccessRequestFacts = {
  actorId: string;
  capacityDefinitionIds: readonly string[];
  /** Finalidade do tratamento (definição configurada). */
  processingPurposeDefinitionId: string;
  /** Operação pretendida: consultar metadados, visualizar conteúdo, obter
   *  representação documental… declarada por configuração. */
  operationDefinitionId: string;
  /** Escopo institucional do ator (unidades, setores, colegiados). */
  scopeEntities: readonly DossierEntityReference[];
  requestedAt: string;
  /** Requisitos já atendidos pelo ator (justificativa, autorização…). */
  satisfiedRequirementDefinitionIds?: readonly string[];
};

/** Descritor do recurso submetido à política. */
export type GovernedResourceDescriptor = {
  reference: DossierEntityReference;
  /** registro de prontuário, documento, representação, relação… (aberto) */
  resourceKindDefinitionId: string;
  typeDefinitionId: string;
  sensitivityLevelDefinitionId: string;
  subjectReferences: readonly DossierSubjectReference[];
  scopeEntities: readonly DossierEntityReference[];
  /** Campos projetáveis do recurso (caminhos), para redação por atributo. */
  projectableFieldPaths: readonly string[];
  effectiveDate?: string;
  recordedAt?: string;
};

export type AccessEffectDeclaration = {
  accessEffectDefinitionId: string;
  executorId: string;
  parameters?: Readonly<Record<string, unknown>>;
};

export type AccessPolicyRule = {
  ruleId: string;
  /** Ordem de aplicação declarada; o motor não conhece precedência normativa. */
  priority: number;
  match: {
    capacityDefinitionIds?: readonly string[];
    resourceKindDefinitionIds?: readonly string[];
    typeDefinitionIds?: readonly string[];
    sensitivityLevelDefinitionIds?: readonly string[];
    operationDefinitionIds?: readonly string[];
    processingPurposeDefinitionIds?: readonly string[];
    /** Exige interseção entre escopo do ator e escopo do recurso. */
    requiresScopeIntersection?: boolean;
  };
  effect: AccessEffectDeclaration;
  legalOrInstitutionalBasisReference?: DossierEntityReference;
};

export type DossierAccessPolicy = {
  policyId: string;
  policyVersion: number;
  validFrom: string;
  validUntil: string | null;
  homologated: boolean;
  rules: readonly AccessPolicyRule[];
  /** Efeito aplicado quando nenhuma regra corresponde (configurado). */
  defaultEffect: AccessEffectDeclaration;
  /** Catálogos declarados, para diagnóstico de configuração. */
  accessEffectDefinitionIds?: readonly string[];
  operationDefinitionIds?: readonly string[];
  processingPurposeDefinitionIds?: readonly string[];
};

/**
 * Resultado da execução do efeito de acesso. O motor conhece apenas primitivas:
 * entra na projeção? quais campos? exige auditoria? há requisito pendente?
 */
export type AccessEffectOutcome = {
  includeInProjection: boolean;
  /** Campos autorizados; ausente = todos os projetáveis do recurso. */
  grantedFieldPaths?: readonly string[];
  redactedFieldPaths?: readonly string[];
  requiresAuditRecord: boolean;
  unmetRequirementDefinitionIds?: readonly string[];
  inconclusive?: boolean;
  diagnostics?: readonly string[];
};

export type AccessDecision = {
  resourceReference: DossierEntityReference;
  appliedRuleId: string | null;
  accessEffectDefinitionId: string | null;
  executorId: string | null;
  policyId: string;
  policyVersion: number;
  outcome: AccessEffectOutcome;
  diagnostics: readonly string[];
};

/** Trilha imutável de acesso. Auditar é consequência de política, não flag. */
export type AccessAuditRecord = {
  auditId: InternalId;
  resourceReference: DossierEntityReference;
  actorId: string;
  capacityDefinitionIds: readonly string[];
  operationDefinitionId: string;
  processingPurposeDefinitionId: string;
  accessEffectDefinitionId: string | null;
  appliedRuleId: string | null;
  policyId: string;
  policyVersion: number;
  occurredAt: string;
  scopeEntities: readonly DossierEntityReference[];
  legalOrInstitutionalBasisReference?: DossierEntityReference;
};

// --------------------------------------------- Ciclo de vida / retenção

export type LifecycleConsequenceDeclaration = {
  consequenceDefinitionId: string;
  executorId: string;
  parameters?: Readonly<Record<string, unknown>>;
};

export type LifecycleRule = {
  ruleId: string;
  /** Aplica-se a QUALQUER recurso governado, não só a documentos. */
  resourceKindDefinitionIds: readonly string[];
  typeDefinitionIds?: readonly string[];
  /** Qual data ancora a contagem (definição configurada). */
  anchorDefinitionId: string;
  retentionDurationDays: number;
  consequences: readonly LifecycleConsequenceDeclaration[];
};

export type LifecyclePolicy = {
  policyId: string;
  policyVersion: number;
  homologated: boolean;
  rules: readonly LifecycleRule[];
};

export type LifecycleProposedAction = {
  resourceReference: DossierEntityReference;
  ruleId: string;
  consequenceDefinitionId: string;
  executorId: string;
  /** Data em que a consequência se torna devida. */
  dueDate: string;
  parameters?: Readonly<Record<string, unknown>>;
};

export type LifecycleEvaluation = {
  policyId: string;
  policyVersion: number;
  evaluatedAt: string;
  proposedActions: readonly LifecycleProposedAction[];
  inconclusive: readonly { resourceId: string; diagnostic: string }[];
  diagnostics: readonly string[];
};

// ------------------------------------------------------------- Projeções

export const STUDENT_LIFE_TIMELINE_PROJECTION_SCHEMA_VERSION = 1;

/** Item da linha do tempo. Sem `sourceModule`, sem `isSuperseded` gravado. */
export type TimelineItem = {
  timelineItemId: string;
  /** Natureza da fonte, resolvida pelo catálogo — nunca "13A"/"13B". */
  sourceTypeDefinitionId: string;
  sourceEntityReference: DossierEntityReference;
  sourceProjectionSchemaVersion: number;
  effectiveDate: string;
  recordedAt: string;
  titleSnapshot?: string;
  summary?: string;
  sensitivityLevelDefinitionId?: string;
  /** DERIVADO da cadeia de retificação no instante da projeção. */
  supersededByEntityId: string | null;
  /** Campos suprimidos pela política para este consumidor. */
  redactedFieldPaths: readonly string[];
  /** Conteúdo autorizado, já minimizado. */
  authorizedPayload: Readonly<Record<string, unknown>>;
};

export type StudentLifeTimelineProjection = {
  projectionSchemaVersion: number;
  producedAt: string;
  studentId: string;
  window?: { from?: string; to?: string };
  policyId: string;
  policyVersion: number;
  items: readonly TimelineItem[];
  /** Recursos existentes mas não autorizados: contagem jamais é publicada. */
  diagnostics: readonly string[];
};
