/**
 * Etapa 13E — Efeitos Acadêmicos e Continuidade do Percurso (contratos canônicos).
 *
 * PONTE FORMAL entre o resultado acadêmico oficial (Capítulo 12) e a Vida Escolar:
 *
 *   [12L projeção canônica]  ou  [registro acadêmico externo]  ou  [outra fonte]
 *        → FATOS ACADÊMICOS NORMALIZADOS
 *        → POLÍTICA DE CONTINUIDADE (configurada, versionada, homologável)
 *        → RESOLUÇÃO DE CONTINUIDADE | OBRIGAÇÃO | EQUIVALÊNCIA | PENDÊNCIA
 *
 * REGRAS DO CONTRATO
 * - A 13E NÃO recalcula nota, média, frequência, aprovação, reprovação ou
 *   situação acadêmica. Ela recebe fatos já oficiais e deriva EFEITOS.
 * - A 13E NUNCA constitui inscrição letiva (13B), participação (13B) ou
 *   alocação em turma (13C). Ela publica elegibilidade e obrigações; o ato de
 *   matrícula e o de enturmação permanecem em seus próprios domínios.
 * - `sourceTypeDefinitionId` é ABERTO: 12L e histórico externo são apenas as
 *   duas primeiras fontes; migração legada ou integração de outra rede entra
 *   por adaptador, sem alterar o domínio.
 * - A normalização NÃO cria segunda taxonomia acadêmica: ela preserva a
 *   REFERÊNCIA à resolução da fonte. Percurso sem resolução terminal
 *   (qualitativo, em curso, inconcluso) simplesmente não a possui.
 * - Consequências são registro aberto: `consequenceDefinitionId + executorId +
 *   parameters`. Uma consequência inédita entra por executor registrado.
 * - Estado de obrigação NÃO é campo gravado nem enum: é projeção do ledger de
 *   eventos institucionais, reconstruível em qualquer data histórica.
 * - Equivalência curricular é N:M entre referências curriculares de qualquer
 *   natureza (componente, área, campo de experiência, competência, conjunto).
 * - Autoriza a COMPETÊNCIA declarada (`capacityDefinitionId`), nunca o cargo.
 * - Ausência de dado nunca vira zero, reprovação, equivalência presumida ou
 *   perda de direito: produz pendência estruturada ou resultado inconclusivo.
 * - Datas trafegam em ISO (aaaa-mm-dd); DD/MM/AAAA é apresentação.
 */
import type {
  InstitutionalActReference,
  InternalId,
  StudentLifeDiagnostic,
  StudentLifeProvenance,
} from "./student-life-types";

export const ACADEMIC_CONTINUITY_SCHEMA_VERSION = 1;

// ------------------------------------------------------------------ Valores

export type ContinuityFactValue = string | number | boolean | null;

/** Referência versionada a qualquer definição institucional. */
export type ContinuityDefinitionReference = {
  definitionId: string;
  definitionVersion?: number;
  labelSnapshot?: string;
};

/**
 * Referência curricular de natureza ABERTA: componente, área, campo de
 * experiência, eixo, competência, habilidade, itinerário, conjunto curricular
 * ou qualquer estrutura futuramente cadastrada.
 */
export type CurriculumReference = {
  referenceKindId: string;
  referenceId: string;
  referenceVersion?: number;
  labelSnapshot?: string;
};

// ------------------------------------------------------- Origem normalizada

/** Fato acadêmico atômico já oficial; a 13E não o recalcula. */
export type NormalizedAcademicFact = {
  factKey: string;
  /** `null` = fato indisponível na fonte. Nunca convertido em zero. */
  value: ContinuityFactValue;
  unit?: string;
  unavailableReason?: string;
  labelSnapshot?: string;
};

/** Fatos agrupados por dimensão curricular declarada pela fonte. */
export type NormalizedAcademicDimension = {
  dimensionId: string;
  /** Natureza aberta da dimensão, declarada pela fonte. */
  dimensionKindId: string;
  labelSnapshot?: string;
  curriculumReference?: CurriculumReference;
  facts: readonly NormalizedAcademicFact[];
};

/** Referência à fonte, preservada com versão e instante de materialização. */
export type AcademicOriginSourceReference = {
  kind: string;
  id: string;
  version?: number;
  state?: string;
  labelSnapshot?: string;
  materializedAt?: string;
};

/**
 * Resolução acadêmica REFERENCIADA — nunca reinterpretada. A 13E guarda qual
 * resolução a fonte declarou, em qual registro e em qual versão.
 * A ausência desta referência é legítima e significativa.
 */
export type AcademicResolutionReference = {
  definitionId: string;
  sourceRecordId: string;
  sourceVersion?: number;
  labelSnapshot?: string;
};

/**
 * Fronteira uniforme de leitura: qualquer fonte acadêmica oficial é traduzida
 * para esta forma por um adaptador tipado, sem que o motor conheça a fonte.
 */
export type NormalizedAcademicOrigin = {
  originId: InternalId;
  studentId: InternalId;
  /** Natureza ABERTA da fonte acadêmica. */
  sourceTypeDefinitionId: string;
  /** Versão do schema da fonte traduzida por este adaptador. */
  sourceSchemaVersion: number;
  sourceReference: AcademicOriginSourceReference;
  /** Ausente quando o percurso não possui resolução terminal. */
  resolutionReference?: AcademicResolutionReference;
  facts: readonly NormalizedAcademicFact[];
  dimensions: readonly NormalizedAcademicDimension[];
  provenance: StudentLifeProvenance;
};

/** Registro acadêmico externo protocolado; não presume estrutura da 12L. */
export type ExternalAcademicRecord = {
  externalRecordId: InternalId;
  studentId: InternalId;
  documentTypeDefinitionId: string;
  documentIdentifier?: string;
  issuingEntityName?: string;
  issuanceDate?: string;
  /** Estado de conferência declarado por configuração (aberto). */
  verificationStatusDefinitionId?: string;
  sourceSchemaVersion: number;
  resolutionReference?: AcademicResolutionReference;
  facts: readonly NormalizedAcademicFact[];
  dimensions: readonly NormalizedAcademicDimension[];
  provenance: StudentLifeProvenance;
};

// -------------------------------------------------- Contexto de continuidade

/**
 * Contexto educacional PRETENDIDO no destino. É o que foi AVALIADO — distinto
 * da resolução produzida. Atributos abertos: unidade, oferta, organização
 * acadêmica, matriz curricular e versão, ou o que a rede declarar.
 */
export type ContinuityTargetContext = {
  targetContextId: string;
  attributes: Readonly<Record<string, string>>;
  targetCurriculumReference?: ContinuityDefinitionReference;
};

// --------------------------------------------------------------- Política

/** Comparação primitiva; o identificador é aberto e resolvido por registro. */
export type ContinuityComparison = {
  comparatorId: string;
  value?: ContinuityFactValue;
};

/**
 * Condição declarativa. `conditionKindId` é aberto e resolvido por avaliador
 * registrado: o motor conhece primitivas (comparar fato, contar dimensões),
 * nunca etapa, componente, nota mínima ou percentual.
 */
export type ContinuityCondition = {
  conditionKindId: string;
  parameters: Readonly<Record<string, ContinuityFactValue>>;
};

/** Consequência aberta: identidade normativa + executor + parâmetros. */
export type ContinuityConsequenceDeclaration = {
  consequenceDefinitionId: string;
  executorId: string;
  parameters?: Readonly<Record<string, ContinuityFactValue>>;
};

export type ContinuityRule = {
  ruleId: string;
  labelSnapshot?: string;
  order: number;
  /** Combinador aberto (todas, qualquer, …) resolvido por registro. */
  conditionCombinatorId: string;
  conditions: readonly ContinuityCondition[];
  consequences: readonly ContinuityConsequenceDeclaration[];
  /** Interrompe a avaliação das regras seguintes quando declarado. */
  stopOnMatch?: boolean;
};

/**
 * Coração normativo da etapa. Nenhum valor real da Rede é homologado aqui:
 * `homologated` distingue capacidade configurada de norma vigente.
 */
export type AcademicContinuityPolicy = {
  policyId: string;
  policyVersion: number;
  labelSnapshot?: string;
  validFrom: string;
  validUntil?: string | null;
  homologated: boolean;
  rules: readonly ContinuityRule[];
  /** Estados de resolução de continuidade cadastrados (abertos). */
  resolutionStateDefinitionIds: readonly string[];
  /** Estados de obrigação cadastrados (abertos). */
  obligationStatusDefinitionIds: readonly string[];
  /** Naturezas de obrigação cadastradas (abertas). */
  obligationNatureDefinitionIds: readonly string[];
  /** Naturezas de pendência cadastradas (abertas). */
  issueTypeDefinitionIds: readonly string[];
  provenance: StudentLifeProvenance;
};

// ------------------------------------------------------------- Produtos

/**
 * Resolução de continuidade: o que foi CONCLUÍDO sobre o contexto avaliado.
 * A ausência de um contexto em qualquer lista jamais carrega significado
 * implícito — só o estado declarado significa.
 */
export type AcademicContinuationResolution = {
  resolutionId: InternalId;
  targetContext: ContinuityTargetContext;
  /** Estado cadastrado: elegível, condicionado, inconclusivo, requer análise… */
  resolutionStateDefinitionId: string;
  /** Condicionantes declaradas pela política, quando houver. */
  conditionDefinitionIds?: readonly string[];
  note?: string;
};

/** Obrigação proposta pela política; sua constituição é ato registrado. */
export type ContinuityObligationDraft = {
  obligationNatureDefinitionId: string;
  curriculumReference: CurriculumReference;
  initialStatusDefinitionId: string;
  validFrom: string;
  validUntil?: string | null;
  reasonDefinitionId?: string;
};

/**
 * Obrigação acadêmica longitudinal que atravessa ciclos ("dependência",
 * "progressão parcial", "complementação" e outras naturezas cadastráveis).
 * NÃO possui campo de estado: o estado vigente é projeção do ledger.
 */
export type AcademicContinuityObligation = {
  obligationId: InternalId;
  studentId: InternalId;
  obligationNatureDefinitionId: string;
  curriculumReference: CurriculumReference;
  originReference: {
    originId: InternalId;
    sourceTypeDefinitionId: string;
    evaluationId: InternalId;
    policyId: string;
    policyVersion: number;
  };
  validity: { validFrom: string; validUntil?: string | null };
  provenance: StudentLifeProvenance;
};

/** Evento institucional imutável do ciclo de vida da obrigação. */
export type ObligationLedgerEntry = {
  entryId: InternalId;
  obligationId: InternalId;
  /** Tipo de evento aberto: constituição, cumprimento, dispensa, encerramento… */
  eventTypeDefinitionId: string;
  fromStatusDefinitionId: string | null;
  toStatusDefinitionId: string;
  /** Eficácia do fato institucional (ISO). */
  effectiveDate: string;
  reasonDefinitionId?: string;
  institutionalActReference?: InstitutionalActReference;
  isCorrection: boolean;
  precedingEntryId: InternalId | null;
  provenance: StudentLifeProvenance;
};

/** Pendência acadêmico-administrativa estruturada, nunca decisão presumida. */
export type ContinuityPendingIssue = {
  issueId: InternalId;
  issueTypeDefinitionId: string;
  /** Fatos/documentos faltantes, por identificador. */
  missingFactKeys?: readonly string[];
  requiredDocumentTypeDefinitionIds?: readonly string[];
  /** Autoridade institucional responsável pelo saneamento. */
  responsibleCapacityDefinitionId?: string;
  deadlineDate?: string | null;
  note?: string;
};

/** Solicitação de análise de equivalência produzida pela política. */
export type EquivalenceAnalysisRequest = {
  requestId: InternalId;
  originId: InternalId;
  targetCurriculumReference?: ContinuityDefinitionReference;
  requiredCapacityDefinitionId?: string;
  note?: string;
};

// --------------------------------------------------------- Equivalência N:M

/**
 * Grupo de correspondência curricular N:M. Nunca par obrigatório 1:1: vários
 * componentes de origem podem compor um de destino, uma área pode corresponder
 * a um conjunto, competências podem corresponder a uma dimensão, etc.
 */
export type CurriculumCorrespondenceGroup = {
  groupId: InternalId;
  originReferences: readonly CurriculumReference[];
  targetReferences: readonly CurriculumReference[];
  /** Fatos de apoio à análise (carga horária, resultado, ementa referenciada). */
  supportingFacts?: readonly NormalizedAcademicFact[];
  decision?: EquivalenceDecision;
};

/** Decisão autorizada por COMPETÊNCIA institucional, nunca por cargo. */
export type EquivalenceDecision = {
  decisionId: InternalId;
  /** Natureza aberta: integral, parcial, inequivalência, complementação… */
  decisionKindDefinitionId: string;
  actorReference: { actorId: string; actorNameSnapshot?: string };
  capacityDefinitionId: string;
  institutionalActReference?: InstitutionalActReference;
  targetCurriculumVersion: ContinuityDefinitionReference;
  supportingDocumentIds?: readonly string[];
  decidedAt: string;
  /** Consequências abertas produzidas pela decisão. */
  consequences?: readonly ContinuityConsequenceDeclaration[];
  provenance: StudentLifeProvenance;
};

export type AcademicEquivalenceProcess = {
  equivalenceProcessId: InternalId;
  studentId: InternalId;
  originId: InternalId;
  targetCurriculumVersion: ContinuityDefinitionReference;
  groups: readonly CurriculumCorrespondenceGroup[];
  provenance: StudentLifeProvenance;
};

/** Competência institucional cadastrada; autoriza atos declarados. */
export type ContinuityCapacityDefinition = {
  capacityDefinitionId: string;
  labelSnapshot?: string;
  /** Atos que a competência autoriza, por identificador aberto. */
  authorizedActKindIds: readonly string[];
};

export type ContinuityGovernanceConfiguration = {
  configurationId: string;
  configurationVersion: number;
  capacities: readonly ContinuityCapacityDefinition[];
  /** Naturezas de decisão de equivalência cadastradas (abertas). */
  equivalenceDecisionKindDefinitionIds: readonly string[];
  /** Tipos de evento de obrigação cadastrados (abertos). */
  obligationEventTypeDefinitionIds: readonly string[];
  provenance: StudentLifeProvenance;
};

// ------------------------------------------------------------- Avaliação

/**
 * Avaliação de continuidade: registro bitemporal do que foi avaliado, sob qual
 * política e versão, e o que foi produzido. Retificação encadeia nova avaliação
 * sem apagar a anterior (`supersedesEvaluationId`).
 */
export type ContinuityEvaluation = {
  evaluationId: InternalId;
  studentId: InternalId;
  /** Eficácia da avaliação (ISO). */
  effectiveDate: string;
  originReference: {
    originId: InternalId;
    sourceTypeDefinitionId: string;
    sourceSchemaVersion: number;
    sourceReference: AcademicOriginSourceReference;
    resolutionReference?: AcademicResolutionReference;
  };
  targetContext: ContinuityTargetContext;
  policyReference: { policyId: string; policyVersion: number };
  appliedRuleIds: readonly string[];
  /** `null` = nenhuma resolução declarada pela política: inconclusivo real. */
  resolution: AcademicContinuationResolution | null;
  obligationDrafts: readonly ContinuityObligationDraft[];
  equivalenceRequests: readonly EquivalenceAnalysisRequest[];
  issues: readonly ContinuityPendingIssue[];
  diagnostics: readonly StudentLifeDiagnostic[];
  supersedesEvaluationId?: InternalId;
  provenance: StudentLifeProvenance;
};

export const ACADEMIC_CONTINUITY_MODULE_LABEL =
  "Efeitos acadêmicos e continuidade do percurso";

export const ACADEMIC_CONTINUITY_MODULE_NOTE =
  "A continuidade recebe fatos acadêmicos oficiais — da projeção canônica do encerramento ou de registro acadêmico externo protocolado — e, mediante política institucional configurada e versionada, publica resolução de continuidade, obrigações curriculares longitudinais, necessidade de análise de equivalência e pendências estruturadas. Ela não recalcula resultado acadêmico e não constitui matrícula, participação ou enturmação: esses atos permanecem em seus próprios domínios.";
