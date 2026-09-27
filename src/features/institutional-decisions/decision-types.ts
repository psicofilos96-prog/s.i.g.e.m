/**
 * Etapa 13I — Decisão Institucional e Governança de Configuração (contratos).
 *
 * PRINCÍPIO TRANSVERSAL
 *   Hierarquia organizacional não implica autorização informacional nem
 *   competência operacional. Toda visualização, decisão, ato ou alteração
 *   institucional decorre de capacidade explícita, escopo, vigência, finalidade
 *   e política aplicável.
 *
 * CADEIA OBRIGATÓRIA
 *   fato → política que exige a decisão → alternativas admissíveis →
 *   competência exercida → decisão fundamentada → ato institucional → efeitos
 *
 * REGRAS DO CONTRATO
 * - "Diretor" é rótulo de cargo, nunca autorização. Autoriza a CAPACIDADE
 *   concedida, com escopo institucional e vigência temporal próprios.
 * - Decisão NUNCA reescreve o fato que a motivou: o fato permanece intacto e a
 *   decisão é registro autônomo que o referencia e congela seu instantâneo.
 * - Exceção autorizada não altera a regra geral: ela é decisão sobre um caso.
 * - Nenhuma taxonomia fechada: tipos de processo decisório, naturezas de ato,
 *   motivos de escalonamento, efeitos, níveis de autoridade e restrições de
 *   override são DEFINIÇÕES configuradas (identificadores abertos).
 * - Ausência de informação produz INCONCLUSÃO, nunca autorização.
 * - Retificação preserva integralmente a decisão anterior (cadeia encadeada).
 * - Datas trafegam em ISO internamente; DD/MM/AAAA é apresentação.
 */
import type {
  DossierEntityReference,
  DossierSubjectReference,
  StudentLifeProvenance,
} from "@/features/student-life/dossier-types";

export const INSTITUTIONAL_DECISION_SCHEMA_VERSION = 1;

export const INSTITUTIONAL_DECISION_MODULE_LABEL =
  "Decisão institucional e governança de configuração (13I) — demonstrativa, sem norma homologada.";

export const INSTITUTIONAL_DECISION_PRINCIPLE =
  "Hierarquia organizacional não implica autorização informacional nem competência operacional. Toda visualização, decisão, ato ou alteração institucional decorre de capacidade explícita, escopo, vigência, finalidade e política aplicável.";

// --------------------------------------------------------------- Competência

/**
 * Concessão de competência institucional a um agente. O cargo aparece apenas
 * como rótulo de leitura (`positionLabelSnapshot`) e NUNCA autoriza nada: duas
 * pessoas com o mesmo cargo podem possuir capacidades diferentes.
 *
 * Substituição temporária da Direção funciona por aqui: nova concessão com
 * vigência própria, opcionalmente declarando a delegação de origem — sem trocar
 * nenhuma regra do sistema.
 */
export type InstitutionalCompetenceGrant = {
  grantId: string;
  agentId: string;
  /** Capacidade institucional conferida (identificador aberto). */
  capacityDefinitionId: string;
  /** Escopos em que a capacidade é exercível (unidade, setor, colegiado…). */
  scopeEntities: readonly DossierEntityReference[];
  validFrom: string;
  validUntil: string | null;
  /** Rótulo de cargo, somente leitura humana. Nunca critério de autorização. */
  positionLabelSnapshot?: string;
  /** Concessão de origem, quando esta é delegação/substituição temporária. */
  delegationOfGrantId?: string;
  provenance: StudentLifeProvenance;
};

// ----------------------------------------------------- Efeitos institucionais

/** Efeito declarado por configuração e produzido por executor registrado. */
export type DecisionEffectDeclaration = {
  effectDefinitionId: string;
  executorId: string;
  labelSnapshot?: string;
  parameters?: Readonly<Record<string, unknown>>;
};

// ----------------------------------------------- Alternativas e tipo de processo

/** Alternativa admissível declarada pela configuração do processo decisório. */
export type DecisionAlternativeDefinition = {
  alternativeDefinitionId: string;
  labelSnapshot: string;
  descriptionSnapshot?: string;
  /** Capacidades exigidas para escolher esta alternativa. */
  requiredCapacityDefinitionIds: readonly string[];
  /** Fatos que precisam estar disponíveis para a alternativa ser admissível. */
  requiredFactKeys?: readonly string[];
  /** Efeitos institucionais que a escolha produz. */
  effects: readonly DecisionEffectDeclaration[];
};

export type DecisionProcessTypeDefinition = {
  decisionProcessTypeDefinitionId: string;
  labelSnapshot: string;
  descriptionSnapshot?: string;
  /** Política/regra que EXIGE a decisão; sem ela nada é decidido. */
  requiringPolicyId: string;
  requiringPolicyVersion: number;
  requirementNarrativeSnapshot: string;
  alternatives: readonly DecisionAlternativeDefinition[];
  /** Natureza do ato institucional produzido (aberta). */
  actNatureDefinitionId: string;
  requiresJustification: boolean;
  homologated: boolean;
  validFrom: string;
  validUntil: string | null;
};

// -------------------------------------------------------- Fatos considerados

export const FACT_AVAILABILITY = {
  available: "disponivel",
  unavailable: "indisponivel",
} as const;
export type FactAvailability =
  (typeof FACT_AVAILABILITY)[keyof typeof FACT_AVAILABILITY];

/**
 * Referência a um fato canônico considerado. O valor é INSTANTÂNEO de leitura:
 * mudanças posteriores no domínio de origem não reescrevem a decisão tomada.
 */
export type ConsideredFactReference = {
  factKey: string;
  sourceTypeDefinitionId: string;
  entityId: string;
  entityVersion?: number;
  labelSnapshot: string;
  valueSnapshot?: string | number | boolean | null;
  availability: FactAvailability;
  /** Motivo declarado da indisponibilidade; nunca convertido em zero. */
  unavailabilityReasonSnapshot?: string;
};

// --------------------------------------------------- Processo decisório e ato

export type InstitutionalDecisionProcess = {
  decisionProcessId: string;
  decisionProcessTypeDefinitionId: string;
  /** Objeto(s) da decisão: turma, inscrição, aluno, período, ato, documento… */
  objectReferences: readonly DossierEntityReference[];
  consideredFacts: readonly ConsideredFactReference[];
  scopeEntities: readonly DossierEntityReference[];
  subjectReferences: readonly DossierSubjectReference[];
  /** Por que chegou à Direção (identificador aberto). */
  escalationReasonDefinitionId: string;
  escalationNarrativeSnapshot: string;
  openedOn: string;
  deadline?: { dueDate: string; deadlineOriginTypeDefinitionId: string };
  sensitivityLevelDefinitionId: string;
  projectableFieldPaths: readonly string[];
  provenance: StudentLifeProvenance;
};

/** Ato institucional emitido por uma decisão. Entra por executor registrado. */
export type InstitutionalActEmission = {
  actId: string;
  actNatureDefinitionId: string;
  labelSnapshot: string;
  effectiveDate: string;
  recordedAt: string;
  emittedByAgentId: string;
  effects: readonly DecisionEffectDeclaration[];
  /** Objetos alcançados pelo ato, por referência (nunca cópia de fato). */
  objectReferences: readonly DossierEntityReference[];
};

export type InstitutionalDecisionRecord = {
  decisionRecordId: string;
  decisionProcessId: string;
  decisionProcessTypeDefinitionId: string;
  chosenAlternativeDefinitionId: string;
  /** Competência efetivamente exercida, com a concessão que a sustentava. */
  exercisedCapacityDefinitionId: string;
  exercisedGrantId: string;
  /** Todas as capacidades exigidas pela alternativa escolhida. */
  exercisedCapacityDefinitionIds?: readonly string[];
  /** Concessões que sustentaram cada capacidade exercida. */
  exercisedGrantIds?: readonly string[];

  agentId: string;
  justificationSnapshot?: string;
  /** Instantâneo congelado dos fatos considerados no momento da decisão. */
  consideredFactSnapshot: readonly ConsideredFactReference[];
  effectiveDate: string;
  recordedAt: string;
  act?: InstitutionalActEmission;
  /** Retificação: a decisão anterior permanece íntegra e referenciada. */
  supersedesDecisionRecordId?: string;
  correctionReasonDefinitionId?: string;
  correctionNote?: string;
  provenance: StudentLifeProvenance;
};

// ------------------------------------------ Governança local de configuração

/** Quem tem autoridade para definir determinada configuração. */
export type ConfigurationAuthority = {
  authorityId: string;
  labelSnapshot: string;
  /** Nível declarado por configuração: rede, setor, unidade… (aberto). */
  authorityLevelDefinitionId: string;
  scopeEntities: readonly DossierEntityReference[];
};

/**
 * Âmbito normativo de uma configuração: a quem pertence e qual é a mutabilidade
 * declarada (imutável pela unidade, parametrizável dentro de limites,
 * inteiramente local, dependente de homologação superior…).
 */
export type PolicyScope = {
  policyScopeId: string;
  configurationSubjectDefinitionId: string;
  labelSnapshot: string;
  owningAuthorityId: string;
  mutabilityDefinitionId: string;
};

/** Restrição de override: executor registrado + parâmetros configurados. */
export type OverrideConstraint = {
  constraintExecutorId: string;
  parameters?: Readonly<Record<string, unknown>>;
  messageSnapshot?: string;
};

/** Override permitido à unidade, sempre dentro de limites declarados. */
export type AllowedOverride = {
  allowedOverrideId: string;
  policyScopeId: string;
  parameterDefinitionId: string;
  labelSnapshot: string;
  constraints: readonly OverrideConstraint[];
  requiresSuperiorHomologation: boolean;
};

/** Delegação de capacidade de configurar, com escopo e vigência próprios. */
export type DelegatedConfigurationCapability = {
  delegationId: string;
  policyScopeId: string;
  capacityDefinitionId: string;
  scopeEntities: readonly DossierEntityReference[];
  validFrom: string;
  validUntil: string | null;
};

/** Decisão de configuração da unidade, versionada e encadeada. */
export type InstitutionalConfigurationDecision = {
  configurationDecisionId: string;
  policyScopeId: string;
  parameterDefinitionId: string;
  proposedValue: unknown;
  agentId: string;
  exercisedCapacityDefinitionId: string;
  scopeEntities: readonly DossierEntityReference[];
  effectiveDate: string;
  recordedAt: string;
  awaitingSuperiorHomologation: boolean;
  supersedesConfigurationDecisionId?: string;
  provenance: StudentLifeProvenance;
};
