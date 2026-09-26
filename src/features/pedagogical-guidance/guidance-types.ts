/**
 * Etapa 13H — Acompanhamento Pedagógico (contratos canônicos).
 *
 * PRINCÍPIO FORMAL DA 13H
 *   Nenhuma inferência produzida pelo motor de sinais constitui, por si só,
 *   diagnóstico, classificação pessoal, ocorrência disciplinar, decisão
 *   pedagógica, abertura de acompanhamento ou consequência institucional. O
 *   motor identifica exclusivamente condições declaradas pela configuração e
 *   preserva os fatos que fundamentaram sua avaliação.
 *
 * TRÊS CAMADAS SEMPRE SEPARADAS
 *   1. FATOS CANÔNICOS   — 12L, 13A–13F e demais fontes autorizadas (referência);
 *   2. CAMADA DE ATENÇÃO — definição → avaliação → ocorrência histórica de sinal;
 *   3. CAMADA DE ACOMPANHAMENTO — caso, eventos, responsabilidade, plano,
 *      intervenção, comunicação, encaminhamento.
 *   As PROJEÇÕES (workspace, ficha, turma, timeline, fatos analíticos) leem essas
 *   camadas; nunca criam fato novo.
 *
 * REGRAS DO CONTRATO
 * - A 13H NÃO grava nota, frequência, matrícula, turma, mobilidade, continuidade,
 *   documento, situação acadêmica nem deliberação: referencia os domínios donos.
 * - Toda taxonomia é ABERTA (identificadores configurados): tipos de sinal,
 *   estados, motivos, intervenções, canais, naturezas, destinos, finalidades.
 * - Nada derivável é persistido: estado de sinal, estado de caso, responsável
 *   vigente, versão vigente do plano e pendência de retorno são PROJEÇÕES.
 * - Ausência de registro é ausência: "sem sinal", "sem caso" e "sem intervenção"
 *   nunca significam que está tudo bem.
 * - Observação docente permanece do professor: é referenciada como fonte, nunca
 *   copiada para dentro do acompanhamento.
 * - Datas trafegam em ISO (aaaa-mm-dd); DD/MM/AAAA é apresentação.
 */
import type {
  DossierEntityReference,
  InstitutionalActReference,
  StudentLifeProvenance,
} from "@/features/student-life/dossier-types";

export const PEDAGOGICAL_GUIDANCE_SCHEMA_VERSION = 1;

export const PEDAGOGICAL_GUIDANCE_MODULE_LABEL =
  "Acompanhamento pedagógico (13H) — demonstrativo, sem norma homologada.";

export const PEDAGOGICAL_GUIDANCE_PRINCIPLE =
  "Nenhuma inferência produzida pelo motor de sinais constitui, por si só, diagnóstico, classificação pessoal, ocorrência disciplinar, decisão pedagógica, abertura de acompanhamento ou consequência institucional. O motor identifica exclusivamente condições declaradas pela configuração e preserva os fatos que fundamentaram sua avaliação.";

// ------------------------------------------------------------- Referências

/** Sujeito do acompanhamento: aluno, pessoa, turma, grupo, processo, outro. */
export type PedagogicalSubjectReference = {
  subjectRoleDefinitionId: string;
  reference: DossierEntityReference;
};

/** Referência a fato de OUTRO domínio, sempre versionada e nunca copiada. */
export type GuidanceSourceReference = {
  sourceTypeDefinitionId: string;
  entityId: string;
  entityVersion?: number;
  sourceProjectionSchemaVersion?: number;
  labelSnapshot?: string;
  /** Autoria original preservada (ex.: professor que registrou a observação). */
  authorReference?: DossierEntityReference;
};

export type GuidanceAgentReference = {
  agentId: string;
  agentNameSnapshot?: string;
  /** Atuação pedagógica/funcional canônica, quando o agente atua por ela. */
  assignmentReference?: GuidanceSourceReference;
};

// ------------------------------------------------- Camada de atenção (sinais)

export type GuidanceFactValue = string | number | boolean | null;

/** Fato considerado pela avaliação, com proveniência e ausência explícita. */
export type GuidanceFact = {
  factKey: string;
  scopeKey?: string;
  /** `null` = fato indisponível. Nunca convertido em zero nem em condição atendida. */
  value: GuidanceFactValue;
  unit?: string;
  unavailableReason?: string;
  labelSnapshot?: string;
  sourceReference?: GuidanceSourceReference;
};

/** Condição declarativa; `conditionKindId` é resolvido por avaliador registrado. */
export type GuidanceCondition = {
  conditionKindId: string;
  parameters: Readonly<Record<string, GuidanceFactValue | readonly GuidanceFactValue[]>>;
};

/**
 * Definição de sinal: configuração versionada. Alterar parâmetro gera NOVA
 * versão; ocorrências históricas guardam a versão que as detectou.
 */
export type SignalDefinition = {
  signalDefinitionId: string;
  definitionVersion: number;
  labelSnapshot: string;
  descriptionSnapshot?: string;
  /** Natureza aberta do sinal (frequência, percurso, convivência escolar…). */
  signalKindDefinitionId: string;
  /** Escopo avaliado, declarado por configuração (aluno, componente, turma…). */
  evaluationScopeKindDefinitionId: string;
  conditionCombinatorId: string;
  conditions: readonly GuidanceCondition[];
  /** Estados de ciclo de vida admitidos, cadastrados pela configuração. */
  lifecycleStateDefinitionIds: readonly string[];
  initialLifecycleStateDefinitionId: string;
  sensitivityLevelDefinitionId: string;
  homologated: boolean;
  validFrom: string;
  validUntil?: string | null;
  provenance: StudentLifeProvenance;
};

export const SIGNAL_OUTCOME = {
  satisfied: "condicao-satisfeita",
  notSatisfied: "condicao-nao-satisfeita",
  inconclusive: "avaliacao-inconclusiva",
} as const;
export type SignalOutcome = (typeof SIGNAL_OUTCOME)[keyof typeof SIGNAL_OUTCOME];

/** Diagnóstico estruturado da avaliação; mensagem humana é apresentação. */
export type GuidanceDiagnostic = {
  diagnosticCode: string;
  messageSnapshot: string;
};

/**
 * DETECÇÃO: a regra encontrou (ou não) a condição, num instante, com os fatos
 * que estavam disponíveis. Não é ocorrência institucional.
 */
export type SignalEvaluation = {
  evaluationId: string;
  signalDefinitionId: string;
  definitionVersion: number;
  subjects: readonly PedagogicalSubjectReference[];
  evaluationContext: Readonly<Record<string, string>>;
  evaluatedAt: string;
  outcome: SignalOutcome;
  /** Retrato dos fatos considerados; mudança posterior não reescreve o passado. */
  consideredFacts: readonly GuidanceFact[];
  diagnostics: readonly GuidanceDiagnostic[];
};

/**
 * MATERIALIZAÇÃO HISTÓRICA: a ocorrência existiu para estes sujeitos naquele
 * contexto, detectada por aquela versão da definição. Imutável.
 */
export type PedagogicalSignalOccurrence = {
  occurrenceId: string;
  signalDefinitionId: string;
  definitionVersion: number;
  evaluationId: string;
  subjects: readonly PedagogicalSubjectReference[];
  evaluationContext: Readonly<Record<string, string>>;
  /** Instante em que a ocorrência passou a existir institucionalmente. */
  materializedAt: string;
  factSnapshot: readonly GuidanceFact[];
  sensitivityLevelDefinitionId: string;
  scopeEntities: readonly DossierEntityReference[];
  provenance: StudentLifeProvenance;
};

/**
 * Evento do ciclo de vida do sinal. Estado vigente é PROJEÇÃO deste ledger:
 * "descartado após análise" é decisão institucional posterior, nunca erro.
 */
export type SignalLifecycleEvent = {
  eventId: string;
  occurrenceId: string;
  eventTypeDefinitionId: string;
  fromStateDefinitionId: string | null;
  toStateDefinitionId: string;
  effectiveDate: string;
  reasonDefinitionId?: string;
  /** Caso ao qual a ocorrência passou a estar relacionada, quando houver. */
  relatedCaseId?: string;
  actorReference?: GuidanceAgentReference;
  institutionalActReference?: InstitutionalActReference;
  provenance: StudentLifeProvenance;
};

// ------------------------------------------- Camada de acompanhamento (casos)

/**
 * Caso de acompanhamento pedagógico. Múltiplos sujeitos por princípio; nenhum
 * campo de estado, nenhum `responsibleId` eterno, nenhuma nota/frequência.
 */
export type PedagogicalFollowUpCase = {
  caseId: string;
  subjects: readonly PedagogicalSubjectReference[];
  /** Forma de abertura configurada: sinal, provocação, encaminhamento, outra. */
  openingModeDefinitionId: string;
  /** Fatos e sinais que fundamentaram a abertura, por REFERÊNCIA. */
  foundingReferences: readonly GuidanceSourceReference[];
  processingPurposeDefinitionId: string;
  scopeEntities: readonly DossierEntityReference[];
  openedOn: string;
  sensitivityLevelDefinitionId: string;
  /** Estados admitidos pela política do caso (abertos). */
  lifecycleStateDefinitionIds: readonly string[];
  initialLifecycleStateDefinitionId: string;
  institutionalActReference?: InstitutionalActReference;
  provenance: StudentLifeProvenance;
};

/**
 * Evento do caso. Encerramento traz estado final E motivo INDEPENDENTES:
 * encerrar nunca significa "resolvido".
 */
export type CaseEvent = {
  eventId: string;
  caseId: string;
  eventTypeDefinitionId: string;
  fromStateDefinitionId: string | null;
  toStateDefinitionId: string;
  effectiveDate: string;
  /** Motivo configurado, independente do estado alcançado. */
  reasonDefinitionId?: string;
  /** Marca a saída do caso do curso ativo, quando a configuração o declarar. */
  concludesCase?: boolean;
  actorReference?: GuidanceAgentReference;
  institutionalActReference?: InstitutionalActReference;
  isCorrection?: boolean;
  precedingEventId?: string;
  provenance: StudentLifeProvenance;
};

/** Responsabilidade TEMPORAL pelo caso; pode mudar sem reescrever a história. */
export type CaseResponsibilityAssignment = {
  assignmentId: string;
  caseId: string;
  agentReference: GuidanceAgentReference;
  capacityDefinitionId: string;
  validFrom: string;
  validUntil: string | null;
  provenance: StudentLifeProvenance;
};

/** Participação no caso: distinta de responsabilidade, também temporal. */
export type CaseParticipation = {
  participationId: string;
  caseId: string;
  participantReference: DossierEntityReference;
  participationRoleDefinitionId: string;
  validFrom: string;
  validUntil: string | null;
  provenance: StudentLifeProvenance;
};

// ----------------------------------------------------------------- Planos

export type PlanItem = {
  planItemId: string;
  objectiveSnapshot: string;
  objectiveDefinitionId?: string;
  actionTypeDefinitionId: string;
  responsibleReference?: GuidanceAgentReference;
  dueDate?: string;
  followUpModeDefinitionId?: string;
  /** Estado do item, cadastrado pela configuração. */
  itemStateDefinitionId: string;
};

/** Plano como entidade: identidade estável, independente das revisões. */
export type FollowUpPlan = {
  planId: string;
  caseId: string;
  labelSnapshot: string;
  provenance: StudentLifeProvenance;
};

/** Revisão cria NOVA versão encadeada; itens anteriores nunca são alterados. */
export type FollowUpPlanVersion = {
  planVersionId: string;
  planId: string;
  version: number;
  precedingPlanVersionId?: string;
  revisionReasonDefinitionId?: string;
  createdAt: string;
  createdBy: GuidanceAgentReference;
  items: readonly PlanItem[];
  provenance: StudentLifeProvenance;
};

// ------------------------------------------------ Intervenções e observações

export type InterventionParticipant = {
  participantReference: DossierEntityReference;
  participationRoleDefinitionId: string;
  /** Fundamento da presença institucional, quando a política exigir. */
  authorizationBasisDefinitionId?: string;
};

export type InterventionRecord = {
  interventionId: string;
  caseId: string;
  interventionTypeDefinitionId: string;
  occurredAt: string;
  participants: readonly InterventionParticipant[];
  authorReference: GuidanceAgentReference;
  processingPurposeDefinitionId: string;
  payloadSchemaDefinitionId?: string;
  structuredPayload: Readonly<Record<string, unknown>>;
  sensitivityLevelDefinitionId: string;
  /** Fontes referenciadas (observação docente, fato acadêmico, documento). */
  sourceReferences: readonly GuidanceSourceReference[];
  planItemId?: string;
  provenance: StudentLifeProvenance;
};

/**
 * Fato observado DEPOIS de uma intervenção. Registrar o fato não afirma que a
 * intervenção o causou: `assertsCausality` é sempre `false` por contrato.
 */
export type ObservedFactRecord = {
  observationId: string;
  caseId: string;
  relatedInterventionId?: string;
  observedFactReference: GuidanceSourceReference;
  observedAt: string;
  noteSnapshot?: string;
  assertsCausality: false;
  provenance: StudentLifeProvenance;
};

/** Avaliação institucional de efetividade: registro próprio, com autoria. */
export type EffectivenessAssessment = {
  assessmentId: string;
  caseId: string;
  assessmentTypeDefinitionId: string;
  conclusionDefinitionId: string;
  rationaleSnapshot: string;
  actorReference: GuidanceAgentReference;
  capacityDefinitionId: string;
  assessedAt: string;
  consideredObservationIds: readonly string[];
  provenance: StudentLifeProvenance;
};

// -------------------------------------------------------------- Comunicação

export type CommunicationParticipant = {
  participantReference: DossierEntityReference;
  participationRoleDefinitionId: string;
  /** Responsabilidade/relação que autoriza a interação, quando aplicável. */
  authorizationBasisReference?: GuidanceSourceReference;
};

/**
 * Registro GENÉRICO de comunicação institucional: responsável, professor, outra
 * unidade, equipe externa. Nunca duplica nome, telefone ou parentesco.
 */
export type CommunicationRecord = {
  communicationId: string;
  caseId?: string;
  communicationNatureDefinitionId: string;
  channelDefinitionId: string;
  processingPurposeDefinitionId: string;
  occurredAt: string;
  participants: readonly CommunicationParticipant[];
  outcomeDefinitionId?: string;
  structuredOutcome?: Readonly<Record<string, unknown>>;
  sensitivityLevelDefinitionId: string;
  provenance: StudentLifeProvenance;
};

// ------------------------------------------------------------ Encaminhamentos

/** Expectativa de retorno CONFIGURADA: sem retorno, ciência, resposta, outra. */
export type ReferralResponseExpectationDefinition = {
  responseExpectationDefinitionId: string;
  labelSnapshot: string;
  requiresResponse: boolean;
  responseWindowDays?: number;
};

export type ReferralPolicy = {
  policyId: string;
  policyVersion: number;
  homologated: boolean;
  /** Expectativas admitidas por tipo de encaminhamento. */
  expectationsByReferralType: Readonly<Record<string, string>>;
  expectations: readonly ReferralResponseExpectationDefinition[];
  /** Capacidades que autorizam encaminhar, por tipo. */
  requiredCapacityByReferralType?: Readonly<Record<string, readonly string[]>>;
};

export type ReferralRecord = {
  referralId: string;
  caseId?: string;
  referralTypeDefinitionId: string;
  /** Destino POLIMÓRFICO: setor, colegiado, unidade, rede externa, equipe. */
  destinationReference: DossierEntityReference;
  reasonSnapshot: string;
  reasonDefinitionId?: string;
  sourceReferences: readonly GuidanceSourceReference[];
  issuedAt: string;
  issuedBy: GuidanceAgentReference;
  referralPolicyId: string;
  referralPolicyVersion: number;
  institutionalActReference?: InstitutionalActReference;
  sensitivityLevelDefinitionId: string;
  provenance: StudentLifeProvenance;
};

/** Manifestação do destinatário; a 13H não decide como o destino trabalha. */
export type ReferralResponseEvent = {
  responseEventId: string;
  referralId: string;
  responseKindDefinitionId: string;
  respondedAt: string;
  respondentReference: DossierEntityReference;
  structuredPayload?: Readonly<Record<string, unknown>>;
  provenance: StudentLifeProvenance;
};
