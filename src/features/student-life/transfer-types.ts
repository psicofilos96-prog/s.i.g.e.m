/**
 * Etapa 13D — Mobilidade e Transferências Institucionais (contratos).
 *
 * CADEIA CONCEITUAL
 *   [13A] PESSOA → ALUNO → VÍNCULO COM A UNIDADE
 *   → [13B] INSCRIÇÃO LETIVA → PARTICIPAÇÃO EDUCACIONAL
 *   → [13C] ALOCAÇÃO EM TURMA
 *   → [13D] PROCESSO INSTITUCIONAL DE MOBILIDADE
 *   → [13E] EFEITOS ACADÊMICOS E CONTINUIDADE DO PERCURSO
 *
 * PRINCÍPIOS DESTE CONTRATO
 * - Transferência NÃO é transação de formulário: é PROCESSO institucional
 *   histórico, com identidade permanente, versões de representação e um ledger
 *   de transições que é a única fonte do estágio vigente.
 * - ORIGEM e DESTINO são SIMÉTRICOS e POLIMÓRFICOS: cada polo é uma referência
 *   `contextReferenceTypeDefinitionId` + `payloadSchemaDefinitionId` +
 *   `attributes` estruturados. O contrato não conhece "interno" nem "externo":
 *   unidade da rede, rede estadual, escola conveniada, instituição estrangeira
 *   ou qualquer categoria futura entram como DADO cadastrado.
 * - Nenhuma flag semântica de estágio existe (`terminatesOriginContext`,
 *   `allowsDestinationCreation`, `isTerminal`, `requiresOriginatingAct` etc.).
 *   A cadeia é: transição → efeitos institucionais configurados → executores
 *   registrados.
 * - Nada derivável é persistido: estágio vigente, versão vigente, quantidade de
 *   versões e "destino conhecido?" são PROJEÇÕES da cadeia.
 * - Ausência de destino é FATO EPISTÊMICO estruturado (motivo, declarante,
 *   papel do declarante, ato e proveniência) — nunca um booleano.
 * - O efeito sobre participações e sobre o vínculo escolar NÃO mora aqui: o
 *   motor publica fatos e a política configurada determina o efeito.
 * - O intervalo institucional de transição é entidade de primeira classe, cuja
 *   NATUREZA vem exclusivamente da configuração. O motor não conhece "trânsito
 *   regulamentar" nem qualquer outro nome.
 * - A 13D não cria turma nem alocação no destino (competência da 13C na unidade
 *   receptora) e não determina situação acadêmica: publica o fato de mobilidade.
 * - Datas trafegam em ISO (aaaa-mm-dd); DD/MM/AAAA é apresentação.
 */
import type {
  EventPayloadSchemaDefinition,
  InstitutionalActReference,
  InstitutionalIdentifier,
  InternalId,
  StudentLifeProvenance,
} from "./student-life-types";
import type {
  RequirementEffectDefinition,
  RequirementEvaluationStatus,
  VersionedDefinitionReference,
} from "./cycle-enrollment-types";

export const INSTITUTIONAL_TRANSFER_SCHEMA_VERSION = 1;

// ------------------------------------------- Referência polimórfica de contexto

/** Atributos estruturados do polo, validados contra o schema declarado. */
export type MobilityContextAttributes = Readonly<
  Record<string, string | number | boolean | null>
>;

/**
 * Referência a um CONTEXTO EDUCACIONAL de origem ou de destino.
 *
 * O motor conhece apenas três coisas: o tipo cadastrado, o schema do payload e
 * os atributos. Um terceiro, quarto ou décimo tipo de contexto entra por
 * configuração, sem alteração deste contrato.
 */
export type MobilityContextReference = {
  contextReferenceTypeDefinitionId: string;
  payloadSchemaDefinitionId: string;
  attributes: MobilityContextAttributes;
  /** Rótulo exibível conforme registrado à época; o histórico não é reescrito. */
  labelSnapshot?: string;
};

/** Tipo de referência de contexto declarado pela rede (catálogo aberto). */
export type MobilityContextReferenceTypeDefinition = {
  contextReferenceTypeDefinitionId: string;
  labelSnapshot: string;
  payloadSchemaDefinitionId: string;
};

/** Quem prestou uma declaração institucional; papel é definição aberta. */
export type DeclarantReference = {
  /** Identificação técnica do declarante, quando existir no SIGEM. */
  declarantId?: string;
  /** Natureza/papel do declarante (aberto): responsável, estudante, órgão… */
  declarantRoleDefinitionId: string;
  /** Identificação documental exibível do declarante, quando registrada. */
  declarantIdentification?: string;
  labelSnapshot?: string;
};

/**
 * AUSÊNCIA de referência de contexto representada epistemicamente.
 * Substitui qualquer `destinationKnown: false`: há motivo estruturado,
 * declarante, papel do declarante, ato e proveniência.
 */
export type MobilityContextAbsenceRecord = {
  absenceReasonDefinitionId: string;
  declarant?: DeclarantReference;
  act?: InstitutionalActReference;
  provenance: StudentLifeProvenance;
  /** Leitura humana complementar; nunca critério de decisão. */
  note?: string;
};

/**
 * POLO da mobilidade: referência presente OU ausência registrada.
 * "Destino conhecido?" é projeção (`isContextKnown`), nunca campo gravado.
 */
export type MobilityPole = {
  reference: MobilityContextReference | null;
  absence?: MobilityContextAbsenceRecord;
};

// ------------------------------------- Intervalo institucional de transição

/**
 * Natureza do intervalo entre a saída de um contexto e o acolhimento em outro,
 * DECLARADA pela rede. O motor nunca presume nome, duração ou consequência.
 */
export type TransitionIntervalKindDefinition = {
  transitionKindDefinitionId: string;
  labelSnapshot: string;
  /** Efeitos institucionais que a rede associa a este intervalo, se houver. */
  effectDefinitionIds?: readonly string[];
};

/**
 * Intervalo institucional de transição: permite responder historicamente
 * "qual era a condição institucional conhecida deste percurso entre duas datas?"
 * sem inventar falta, abandono ou situação acadêmica.
 */
export type InstitutionalTransitionIntervalRecord = {
  transitionIntervalId: InternalId;
  transferProcessId: InternalId;
  /** Natureza configurada; o motor apenas a referencia. */
  transitionKindDefinitionId: string;
  startDate: string;
  /** Prazo declarado pela norma ou pelo ato, quando houver. */
  deadlineDate?: string;
  /** Data do acolhimento efetivo; `null`/ausente = intervalo em curso. */
  concludedDate?: string | null;
  act?: InstitutionalActReference;
  provenance: StudentLifeProvenance;
};

// ------------------------------------------------------------- Documentos

/**
 * Documento de suporte do processo. Estados documentais e de verificação são
 * DEFINIÇÕES CADASTRADAS por identificador estável, nunca enumerações fechadas.
 */
export type TransferDocumentRecord = {
  documentRecordId: InternalId;
  transferProcessId: InternalId;
  documentTypeDefinitionId: string;
  /** Identificação documental exibível (número da guia, protocolo…). */
  documentIdentifier?: string;
  issuingAuthority?: string;
  issuanceDate?: string;
  documentStatusDefinitionId: string;
  verificationStatusDefinitionId?: string;
  act?: InstitutionalActReference;
  provenance: StudentLifeProvenance;
};

export type TransferDocumentStatusDefinition = {
  documentStatusDefinitionId: string;
  labelSnapshot: string;
};

export type TransferVerificationStatusDefinition = {
  verificationStatusDefinitionId: string;
  labelSnapshot: string;
};

// --------------------------------------- Efeitos institucionais configurados

/**
 * Aplicação de um efeito institucional: a rede declara O QUE deve acontecer
 * (`effectDefinitionId`), QUEM executa (`effectExecutorId`) e com quais
 * parâmetros. Um efeito inédito entra por registro de executor, sem novo campo.
 */
export type InstitutionalEffectApplication = {
  effectDefinitionId: string;
  effectExecutorId: string;
  parameters?: Readonly<Record<string, string | number | boolean | null>>;
};

/** Estágio do processo, declarado por configuração (catálogo aberto). */
export type TransferStageDefinition = {
  stageDefinitionId: string;
  labelSnapshot: string;
};

/** Motivo institucional da transição (catálogo aberto). */
export type TransferReasonDefinition = {
  reasonDefinitionId: string;
  labelSnapshot: string;
};

/** Requisito declarativo da transição, resolvido por avaliador registrado. */
export type TransferTransitionRequirement = {
  requirementDefinitionId: string;
  labelSnapshot: string;
  evaluatorId: string;
  effectByStatus: Readonly<Partial<Record<RequirementEvaluationStatus, string>>>;
  defaultEffectDefinitionId?: string;
  parameters?: Readonly<Record<string, string | number | boolean | null>>;
};

/**
 * Transição admitida pela rede. Não possui nenhuma flag semântica: o que a
 * transição PRODUZ está inteiramente em `effects`.
 */
export type TransferStageTransitionDefinition = {
  transitionDefinitionId: string;
  /** Ritos a que se aplica; vazio/ausente = todos. */
  appliesToProcessKindIds?: readonly string[];
  /** `null` = transição de abertura do processo. */
  fromStageDefinitionId: string | null;
  toStageDefinitionId: string;
  allowedReasonDefinitionIds?: readonly string[];
  reasonRequired?: boolean;
  requirements?: readonly TransferTransitionRequirement[];
  /** Efeitos institucionais configurados desta transição. */
  effects?: readonly InstitutionalEffectApplication[];
};

// ---------------------------- Políticas de efeito sobre 13B/13C e vínculo

/**
 * Efeito da mobilidade sobre CADA participação impactada, determinado pela
 * política. A 13D não conhece AEE, itinerário, reforço ou oferta complementar:
 * qualquer conduta (manter, encerrar, exigir decisão, encaminhar) é efeito
 * configurado.
 */
export type TransferParticipationEffectRule = {
  ruleId: string;
  /** Naturezas de participação (13A) a que se aplica; vazio = todas. */
  appliesToNatureDefinitionIds?: readonly string[];
  /** Ofertas educacionais a que se aplica; vazio = todas. */
  appliesToEducationalOfferIds?: readonly string[];
  effect: InstitutionalEffectApplication;
};

export type TransferParticipationEffectPolicy = {
  policyId: string;
  policyVersion: number;
  rules: readonly TransferParticipationEffectRule[];
  /** Conduta quando a política não previr a participação; ausente = inconclusivo. */
  undeclaredParticipationEffect?: InstitutionalEffectApplication;
};

/** Comparador primitivo; o motor compara números e não interpreta a norma. */
export type NumericComparatorId = "eq" | "neq" | "lte" | "lt" | "gte" | "gt";

/**
 * Efeito sobre o VÍNCULO ESCOLAR (13A) a partir de FATOS publicados pelo motor
 * (ex.: quantas inscrições ou participações permanecem vigentes no vínculo).
 * A regra "encerra se não houver outras inscrições vigentes" é CONFIGURAÇÃO.
 */
export type SchoolBondEffectRule = {
  ruleId: string;
  /** Chave do fato publicado pelo motor (aberta). */
  factKeyId: string;
  comparator: NumericComparatorId;
  value: number;
  effect: InstitutionalEffectApplication;
};

export type SchoolBondEffectPolicy = {
  policyId: string;
  policyVersion: number;
  rules: readonly SchoolBondEffectRule[];
  /** Conduta quando nenhuma regra casar; ausente = inconclusivo. */
  undeclaredEffect?: InstitutionalEffectApplication;
};

// ------------------------- Política de projeção de situação de vida escolar

/**
 * Mapeia o FATO OFICIAL de mobilidade publicado pela 13D para uma situação de
 * vida escolar configurada (ex.: `sit-rede-transferido`). A 13D não conhece
 * nenhum identificador de situação; a 13E tampouco o atribui por código.
 */
export type StudentLifeSituationProjectionRule = {
  ruleId: string;
  /** Tipo do fato de mobilidade a que a regra se aplica. */
  appliesToMobilityFactTypeId: string;
  appliesToProcessKindIds?: readonly string[];
  appliesToDestinationTypeIds?: readonly string[];
  /** Exige destino conhecido? Ausente = indiferente. */
  requiresKnownDestination?: boolean;
  producesSituationDefinitionId: string;
};

export type StudentLifeSituationProjectionPolicy = {
  policyId: string;
  policyVersion: number;
  rules: readonly StudentLifeSituationProjectionRule[];
};

/** Projeção reproduzível: qual política, em qual versão, produziu a situação. */
export type StudentLifeSituationProjection = {
  studentId: InternalId;
  transferProcessId: InternalId;
  situationDefinitionId: string;
  effectiveDate: string;
  producedFromFactTypeId: string;
  producedByPolicy: VersionedDefinitionReference;
  producedByRuleId: string;
  projectedAt: string;
};

// ------------------------------------------------- Processo e suas versões

/** Enquadramento histórico congelado das definições que sustentaram o registro. */
export type TransferDefinitionSnapshot = {
  governanceConfiguration: VersionedDefinitionReference;
  participationEffectPolicy: VersionedDefinitionReference;
  schoolBondEffectPolicy: VersionedDefinitionReference;
  /** Política temporal aplicada ao encerramento das alocações (13C). */
  allocationTimingPolicy?: VersionedDefinitionReference;
  originContextType?: VersionedDefinitionReference;
  destinationContextType?: VersionedDefinitionReference;
};

/**
 * IDENTIDADE PERMANENTE do processo institucional de mobilidade.
 *
 * NÃO possui `activeVersionId` nem `versionsCount`: versão vigente e quantidade
 * de versões são projeções da cadeia (`transfer-ledger`). Uma retificação de
 * data ou de destino NÃO cria outro processo — cria outra versão do registro.
 */
export type InstitutionalTransferProcess = {
  transferProcessId: InternalId;
  institutionalIdentifier?: InstitutionalIdentifier;
  studentId: InternalId;
  /** Rito configurado (aberto): mobilidade entre unidades, saída, ingresso… */
  processKindDefinitionId: string;
  provenance: StudentLifeProvenance;
};

/**
 * VERSÃO DA REPRESENTAÇÃO ADMINISTRATIVA do processo. O que mudou, quando
 * passou a ser conhecido e por qual motivo — sem reescrever a versão anterior.
 */
export type TransferProcessVersionRecord = {
  transferProcessVersionId: InternalId;
  transferProcessId: InternalId;
  /** Somente a direção retrospectiva é gravada; a futura é projetada. */
  precedingVersionId?: InternalId | null;

  studentId: InternalId;
  processKindDefinitionId: string;

  /** Polos simétricos e polimórficos. */
  originPole: MobilityPole;
  destinationPole: MobilityPole;

  /** Política temporal (13C) que compõe o fim da vigência na origem. */
  timingBoundaryDefinitionId?: string;

  transitionInterval?: InstitutionalTransitionIntervalRecord;
  documents?: readonly TransferDocumentRecord[];

  definitionSnapshot: TransferDefinitionSnapshot;
  provenance: StudentLifeProvenance;
};

/**
 * Registro imutável de TRANSIÇÃO no ledger do processo. É a ÚNICA fonte do
 * estágio vigente; nenhum `currentStageDefinitionId` é gravado na entidade.
 */
export type TransferStageTransitionRecord = {
  transitionId: InternalId;
  transferProcessId: InternalId;
  transitionDefinitionId: string;
  sequenceNumber: number;
  fromStageDefinitionId: string | null;
  toStageDefinitionId: string;
  reasonDefinitionId?: string;
  /** Eficácia institucional do fato (ISO aaaa-mm-dd). */
  effectiveDate: string;
  /** Efeitos efetivamente aplicados nesta transição, conforme configurado. */
  appliedEffects?: readonly InstitutionalEffectApplication[];
  originatingAct?: InstitutionalActReference;
  /** Versão da representação em que a transição foi registrada, quando aplicável. */
  recordedInVersionId?: InternalId;
  isCorrection: boolean;
  precedingTransitionId?: InternalId | null;
  provenance: StudentLifeProvenance;
};

// ------------------------------------------------- Configuração da 13D

export type InstitutionalTransferGovernanceConfiguration = {
  configurationId: string;
  configurationVersion: number;
  /** Ritos declarados (aberto), cada um com seu estágio inicial configurado. */
  processKinds: readonly {
    processKindDefinitionId: string;
    labelSnapshot: string;
    initialStageDefinitionId: string;
  }[];
  stages: readonly TransferStageDefinition[];
  transitions: readonly TransferStageTransitionDefinition[];
  reasons: readonly TransferReasonDefinition[];
  /** Catálogo de efeitos de requisito (capacidades declaradas pela rede). */
  requirementEffects: readonly RequirementEffectDefinition[];
  contextReferenceTypes: readonly MobilityContextReferenceTypeDefinition[];
  payloadSchemas: readonly EventPayloadSchemaDefinition[];
  documentStatuses: readonly TransferDocumentStatusDefinition[];
  verificationStatuses: readonly TransferVerificationStatusDefinition[];
  transitionIntervalKinds: readonly TransitionIntervalKindDefinition[];
  participationEffectPolicy: TransferParticipationEffectPolicy;
  schoolBondEffectPolicy: SchoolBondEffectPolicy;
};
