/**
 * Etapa 13B — Inscrição Letiva (matrícula e rematrícula) — contratos canônicos.
 *
 * CADEIA CONCEITUAL
 *   [13A] PESSOA → ALUNO → VÍNCULO INSTITUCIONAL COM A UNIDADE
 *   → [13B] INSCRIÇÃO LETIVA → [13B] PARTICIPAÇÃO EDUCACIONAL
 *   → [13C] ALOCAÇÃO EM TURMA
 *
 * SEMÂNTICA DAS QUATRO REFERÊNCIAS (nunca sobrepostas):
 *   academicCycle       = intervalo/estrutura TEMPORAL (ano, semestre, módulo…).
 *   educationalOffer    = SERVIÇO educacional ofertado pela unidade.
 *   academicOrganization= POSIÇÃO/agrupamento curricular do aluno na oferta.
 *   curriculumMatrix    = ESTRUTURA curricular aplicável (pode ser nenhuma,
 *                         uma, várias ou derivada posteriormente).
 *
 * REGRAS DO CONTRATO
 * - Uma inscrição pertence a UM contexto `unidade + ciclo + oferta`. Coexistência
 *   entre contextos (ex.: escolarização em uma unidade e atendimento
 *   especializado em outra) é resolvida por POLÍTICA entre inscrições.
 * - `CycleParticipation` é entidade temporal PRÓPRIA, consultada por
 *   `cycleEnrollmentId` — nunca subdocumento da inscrição.
 * - `validUntil` significa exclusivamente FIM DE VIGÊNCIA. O motivo, o rito e o
 *   ato pertencem ao evento/transição correspondentes.
 * - Nenhum identificador de estado, motivo, efeito, rito, requisito, etapa,
 *   modalidade, ano civil ou prazo vive no motor: tudo é DADO configurado.
 * - Nada derivável é persistido: "ingresso tardio", "tem pendência" e afins são
 *   interpretações do consumidor (CIECE), não campos desta entidade.
 * - Datas trafegam em ISO (aaaa-mm-dd); DD/MM/AAAA é apresentação.
 */
import type {
  InstitutionalActReference,
  InstitutionalIdentifier,
  InternalId,
  StudentLifeProvenance,
} from "./student-life-types";

export const CYCLE_ENROLLMENT_SCHEMA_VERSION = 1;

// ------------------------------------------------- Referências versionadas

/**
 * Referência a uma definição institucional PRESERVANDO a versão vigente no ato.
 * Uma inscrição de 2027 nunca deve ser reinterpretada pela configuração de 2032.
 */
export type VersionedDefinitionReference = {
  definitionId: string;
  /** Versão da definição no instante da constituição, quando versionada. */
  definitionVersion?: number;
  /** Rótulo exibível conforme registrado à época; o histórico não é reescrito. */
  labelSnapshot?: string;
};

/**
 * Enquadramento histórico congelado da inscrição: quais definições, em quais
 * versões, sustentaram aquele ato. Não substitui as referências vivas — preserva
 * como aquele contexto era entendido quando a inscrição foi constituída.
 */
export type EnrollmentDefinitionSnapshot = {
  academicCycle: VersionedDefinitionReference;
  educationalOffer: VersionedDefinitionReference;
  /** Posição/agrupamento curricular, quando a oferta o define. */
  academicOrganization?: VersionedDefinitionReference;
  /**
   * Estruturas curriculares aplicáveis. Lista, e não campo único: pode estar
   * vazia (oferta sem matriz), conter uma, conter várias, ou ser resolvida
   * depois. O motor nunca exige exatamente uma.
   */
  curriculumMatrices: readonly VersionedDefinitionReference[];
  /** Configuração de governança da 13B vigente no ato. */
  governanceConfiguration: VersionedDefinitionReference;
  /** Política de requisitos aplicada ao rito, quando houver. */
  requirementPolicy?: VersionedDefinitionReference;
};

// ------------------------------------------------------------- Vigência

/** Vigência pura: início e fim. Nenhuma causa institucional mora aqui. */
export type EnrollmentValidity = {
  /** Data de eficácia do início da inscrição para ESTE aluno (ISO). */
  validFrom: string;
  /** Fim da vigência da inscrição; `null` = em curso. Sem semântica de motivo. */
  validUntil: string | null;
};

// ------------------------------------------------------- Inscrição letiva

export type AcademicCycleEnrollment = {
  /** ID técnico interno opaco e imutável. */
  cycleEnrollmentId: InternalId;
  /** Identificador institucional exibível, de padrão configurável. */
  institutionalIdentifier?: InstitutionalIdentifier;

  /** Vínculos da 13A: o aluno e sua relação duradoura com ESTA unidade. */
  studentId: InternalId;
  schoolBondId: InternalId;
  schoolId: string;

  /** Contexto educacional por IDs estáveis — nunca ano civil nem rótulo. */
  academicCycleId: string;
  educationalOfferId: string;
  academicOrganizationId?: string;
  /** Estruturas curriculares referenciadas, quando já resolvidas. */
  curriculumMatrixIds: readonly string[];

  /** Rito que produziu a inscrição (aberto): ingresso, renovação, reintegração… */
  admissionProcessKindId: string;
  /** Requerimento que a originou, quando a política adotar rito prévio. */
  originatingRequestId?: InternalId | null;

  /** Estado configurado da inscrição (máquina própria, declarada em dado). */
  enrollmentStateDefinitionId: string;
  enrollmentStateReasonDefinitionId?: string;

  validity: EnrollmentValidity;

  /** Enquadramento histórico congelado no ato da constituição. */
  definitionSnapshot: EnrollmentDefinitionSnapshot;

  /** Versão do registro; retificação cria nova versão encadeada. */
  recordVersion: number;
  supersedesEnrollmentId?: InternalId | null;
  supersededByEnrollmentId?: InternalId | null;

  /** Eventos do ledger da 13A que produziram este estado. */
  sourceEventIds: readonly InternalId[];
  provenance: StudentLifeProvenance;
};

// ------------------------------------------------- Participação educacional

/**
 * Entidade temporal PRÓPRIA, filha da inscrição por `cycleEnrollmentId`.
 * Pode iniciar, encerrar, ser retificada e ter estado próprio no meio do ciclo.
 * A alocação em turma (13C) apontará para a PARTICIPAÇÃO, não para a inscrição.
 */
export type CycleParticipation = {
  participationId: InternalId;
  cycleEnrollmentId: InternalId;
  /** Natureza declarada por configuração (13A). */
  natureDefinitionId: string;
  /** Estado configurado da participação (máquina própria). */
  participationStateDefinitionId: string;
  participationStateReasonDefinitionId?: string;
  validity: EnrollmentValidity;
  labelSnapshot?: string;
  recordVersion: number;
  supersedesParticipationId?: InternalId | null;
  supersededByParticipationId?: InternalId | null;
  sourceEventIds: readonly InternalId[];
  provenance: StudentLifeProvenance;
};

// -------------------------------------------- Requerimento (quando exigido)

/**
 * Solicitação/requerimento de matrícula. EXISTE SOMENTE quando a política
 * institucional a exigir: intenção/processo ≠ inscrição constituída.
 */
export type EnrollmentRequest = {
  requestId: InternalId;
  studentId: InternalId;
  targetSchoolId: string;
  targetAcademicCycleId: string;
  targetEducationalOfferId: string;
  /** Rito do requerimento (aberto). */
  requestProcessKindId: string;
  /** Estado configurado do requerimento. */
  requestStateDefinitionId: string;
  requestStateReasonDefinitionId?: string;
  requestedAt: string;
  resolvedAt?: string | null;
  resolutionAct?: InstitutionalActReference;
  provenance: StudentLifeProvenance;
};

// --------------------------------------------------- Requisitos declarativos

/** Resultado técnico do avaliador — primitiva, não efeito institucional. */
export type RequirementEvaluationStatus =
  | "satisfeito"
  | "nao-satisfeito"
  | "nao-aplicavel"
  | "inconclusivo"
  | "erro-de-configuracao";

/** Origem/proveniência do prazo: da regra, calculado, concedido, por ato. */
export type RequirementDeadline = {
  date: string;
  /** Natureza da origem do prazo (aberta, declarada por configuração). */
  originKindId: string;
  /** Agente que concedeu o prazo individualmente, quando houver. */
  grantedByAgentId?: string;
  /** Ato institucional que fixou ou prorrogou o prazo, quando houver. */
  act?: InstitutionalActReference;
  /** Prazo anterior substituído por este. */
  supersedesDate?: string;
  note?: string;
};

/**
 * Definição configurada de um requisito. O EFEITO institucional do resultado
 * é `requirementEffectDefinitionId` — jamais uma união fechada de código.
 */
export type EnrollmentRequirementDefinition = {
  requirementDefinitionId: string;
  labelSnapshot: string;
  /** Avaliador registrado que resolve este requisito (nunca switch por tipo). */
  evaluatorId: string;
  /** Ritos aos quais o requisito se aplica; vazio = todos os ritos da política. */
  appliesToProcessKindIds?: readonly string[];
  /** Efeito institucional por resultado do avaliador (configurado). */
  effectByStatus: Readonly<Partial<Record<RequirementEvaluationStatus, string>>>;
  /** Efeito quando a política não declarar o resultado obtido. */
  defaultEffectDefinitionId?: string;
  parameters?: Readonly<Record<string, string | number | boolean | null>>;
};

/** Efeito institucional declarado pela rede; o motor só lê suas capacidades. */
export type RequirementEffectDefinition = {
  effectDefinitionId: string;
  labelSnapshot: string;
  /** Impede a transição avaliada? */
  preventsTransition: boolean;
  /** Exige prazo de regularização declarado? */
  requiresRegularizationDeadline?: boolean;
  /** Exige ato institucional para prosseguir (autorização excepcional etc.)? */
  requiresInstitutionalAct?: boolean;
  /** Severidade estrutural para apresentação e consulta. */
  severity: "blocker" | "warning" | "requirement" | "info";
};

export type EnrollmentRequirementPolicy = {
  policyId: string;
  policyVersion: number;
  requirements: readonly EnrollmentRequirementDefinition[];
  effects: readonly RequirementEffectDefinition[];
};

/** Fato atômico do requisito: o consumidor deriva contagens e interpretações. */
export type EnrollmentRequirementEvaluation = {
  requirementDefinitionId: string;
  labelSnapshot: string;
  status: RequirementEvaluationStatus;
  /** Efeito institucional resolvido pela política, nunca fixado no motor. */
  requirementEffectDefinitionId: string | null;
  deadline?: RequirementDeadline | null;
  /** Ato institucional que satisfez, dispensou ou autorizou excepcionalmente. */
  act?: InstitutionalActReference;
  detail?: string;
};

// ----------------------------------------------- Coexistência entre inscrições

/**
 * Declaração de compatibilidade entre INSCRIÇÕES coexistentes, por escopo
 * configurado. Sem noção de horário, capacidade, turno ou turma.
 */
export type EnrollmentCoexistenceRule = {
  ruleId: string;
  /** Naturezas de participação envolvidas, em qualquer unidade. */
  natureDefinitionIds: readonly string[];
  /** Escopo da comparação (aberto): mesma unidade, unidades distintas, rede… */
  comparisonScopeId: string;
  compatible: boolean;
  diagnosticCode?: string;
  note?: string;
};

export type EnrollmentCoexistencePolicy = {
  policyId: string;
  policyVersion: number;
  rules: readonly EnrollmentCoexistenceRule[];
  /** Escopos declarados pela rede; o motor apenas compara identificadores. */
  comparisonScopeIds: readonly string[];
  undeclaredCombinationStateId: "compatible" | "incompatible" | "inconclusive";
};

// --------------------------------------------------- Ritos e sua capacidade

/**
 * Rito capaz de produzir inscrição letiva. Matrícula e rematrícula NÃO são
 * entidades diferentes: são ritos distintos que produzem a mesma entidade.
 */
export type AdmissionProcessDefinition = {
  processKindId: string;
  labelSnapshot: string;
  /** Exige vínculo institucional preexistente com a unidade? */
  requiresExistingSchoolBond?: boolean;
  /** Exige requerimento prévio resolvido? */
  requiresOriginatingRequest?: boolean;
  /** Política de requisitos aplicada a este rito. */
  requirementPolicyId?: string;
  /** Estado inicial atribuído à inscrição constituída por este rito. */
  initialEnrollmentStateDefinitionId: string;
};

/**
 * Capacidade configurada: quais estados do requerimento AUTORIZAM constituir a
 * inscrição. A rede pode chamar de deferida, homologada, validada — ou não usar
 * requerimento algum.
 */
export type RequestStateCapabilityDefinition = {
  requestStateDefinitionId: string;
  allowsEnrollmentCreation: boolean;
};

export type CycleEnrollmentGovernanceConfiguration = {
  configurationId: string;
  configurationVersion: number;
  /** Máquinas de estado da inscrição, da participação e do requerimento. */
  enrollmentMachineId: string;
  participationMachineId: string;
  requestMachineId?: string;
  admissionProcesses: readonly AdmissionProcessDefinition[];
  requirementPolicies: readonly EnrollmentRequirementPolicy[];
  requestStateCapabilities: readonly RequestStateCapabilityDefinition[];
  coexistencePolicy: EnrollmentCoexistencePolicy;
};
