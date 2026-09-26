/**
 * Etapa 13A — Identidade e Vínculo Escolar Canônico (contratos).
 *
 * PRINCÍPIO REITOR DA VIDA ESCOLAR
 *   Entidades representam o ESTADO institucional vigente consultável.
 *   Eventos formam o LEDGER histórico imutável que explica como esse estado
 *   foi produzido. Nenhuma alteração institucional relevante pode modificar
 *   silenciosamente o estado sem deixar o fato histórico, o ato originador e
 *   a proveniência correspondentes.
 *
 * CADEIA CONCEITUAL
 *   PESSOA → ALUNO (papel perante a Rede) → VÍNCULO INSTITUCIONAL COM A UNIDADE
 *   → [13B] MATRÍCULA LETIVA → [13B/13C] PARTICIPAÇÃO → [13C] ALOCAÇÃO EM TURMA
 *
 * REGRAS DO CONTRATO
 * - Três naturezas distintas de identificação: ID técnico interno imutável,
 *   identificador institucional exibível e identificador externo de outro sistema.
 * - Nenhum catálogo normativo vive aqui: estados, motivos, transições, naturezas
 *   de participação, atributos cadastrais e tipos de evento são DEFINIÇÕES
 *   configuradas, referenciadas por identificador aberto.
 * - Datas trafegam em ISO (aaaa-mm-dd) internamente; DD/MM/AAAA é apresentação.
 * - Bitemporalidade: data de eficácia do fato escolar ≠ instante de registro.
 * - Ausência permanece ausência. `null`/omissão nunca viram zero, vazio
 *   semântico ou categoria cadastral.
 * - Minimização (LGPD): identidade e vínculo não carregam prontuário,
 *   documentos, laudos, ocorrências ou dossiê.
 */

export const STUDENT_LIFE_SCHEMA_VERSION = 1;

// ------------------------------------------------- Naturezas de identificação

/**
 * ID técnico interno: opaco, imutável, sem semântica institucional.
 * Nunca é derivado de CPF, INEP, Educacenso, certidão ou sistema legado.
 */
export type InternalId = string;

/**
 * Identificador institucional exibível (ex.: número SIGEM do aluno, número de
 * registro do vínculo). É apresentável a humanos e seu PADRÃO é configurável:
 * pode mudar sem alterar a identidade técnica da entidade.
 */
export type InstitutionalIdentifier = {
  /** Valor exibido. */
  value: string;
  /** Definição do padrão de numeração que o produziu, quando conhecida. */
  patternDefinitionId?: string;
  /** Vigência do identificador exibível, quando houver substituição de padrão. */
  validFrom?: string;
  validUntil?: string | null;
  /** Identificador exibível anterior, quando este o substituiu. */
  supersedesValue?: string;
};

/** Identificador pertencente a OUTRO sistema; nunca chave primária do SIGEM. */
export type ExternalIdentifierReference = {
  identifierId: InternalId;
  /** Namespace do sistema externo (aberto, declarado por configuração). */
  systemNamespace: string;
  externalCode: string;
  validFrom?: string;
  validUntil?: string | null;
  /** Estado de conferência declarado por configuração (aberto). */
  validationStateId?: string;
  provenance: StudentLifeProvenance;
};

// ------------------------------------------------------ Proveniência e atos

/**
 * Referência genérica ao ato institucional que ORIGINOU um fato.
 * A 13A não constrói requerimentos, termos, processos ou deferimentos: apenas
 * permite afirmar "este fato existe porque este ato o originou".
 */
export type InstitutionalActReference = {
  actId: string;
  /** Natureza do ato (aberto): requerimento, deferimento, termo, processo… */
  actTypeId: string;
  /** Data de eficácia do ato, quando distinta do fato. */
  actDate?: string;
  /** Identificação documental exibível do ato, quando existir. */
  actIdentifier?: string;
  labelSnapshot?: string;
};

/** Contrato TRANSVERSAL de proveniência do domínio de Vida Escolar. */
export type StudentLifeProvenance = {
  /** Origem do dado (aberto): atendimento presencial, importação, integração… */
  originTypeId: string;
  /** Instante de registro administrativo no SIGEM (ISO com hora). */
  recordedAt: string;
  /** Agente responsável pelo registro, quando identificado. */
  recordedByAgentId?: string;
  recordedByRoleId?: string;
  /** Sistema/‌lote de origem em importações e integrações. */
  sourceSystemNamespace?: string;
  importBatchId?: string;
  /** Ato institucional que originou o fato, quando houver. */
  act?: InstitutionalActReference;
  /** Versão anterior substituída por este registro. */
  supersedesId?: string;
  /** Motivo declarado da retificação (definição configurada). */
  correctionReasonDefinitionId?: string;
  /** Justificativa textual da retificação: leitura humana, nunca critério. */
  correctionNote?: string;
};

// ------------------------------------------------ Ausência x desconhecimento

/**
 * Distingue dado DESCONHECIDO, NÃO INFORMADO e NÃO APLICÁVEL sem transformar
 * nenhum deles em categoria cadastral. `absenceReasonId` é aberto: a rede
 * declara quais ausências reconhece.
 */
export type OptionalValue<TValue> =
  | { present: true; value: TValue }
  | { present: false; absenceReasonId: string; note?: string };

export function presentValue<TValue>(value: TValue): OptionalValue<TValue> {
  return { present: true, value };
}

export function absentValue<TValue>(
  absenceReasonId: string,
  note?: string,
): OptionalValue<TValue> {
  return note === undefined
    ? { present: false, absenceReasonId }
    : { present: false, absenceReasonId, note };
}

// ------------------------------------------------------------------- Pessoa

/**
 * Atributo cadastral configurável: o domínio não conhece nenhum catálogo de
 * valores. Cada atributo aponta para a definição institucional que o descreve.
 */
export type CivilAttributeValue = {
  attributeDefinitionId: string;
  /** Opção escolhida no catálogo configurado, quando o atributo for de escolha. */
  optionDefinitionId?: string;
  /** Valor livre, quando a definição declarar atributo textual/numérico. */
  rawValue?: string;
  provenance?: StudentLifeProvenance;
};

/** Identidade humana canônica, sob minimização estrutural de dados. */
export type Person = {
  personId: InternalId;
  /** Nome civil registral. */
  civilName: string;
  /** Nome social, quando declarado; não substitui o nome civil no histórico. */
  socialName?: string | null;
  /** Data de nascimento em ISO; ausência é explícita, nunca presumida. */
  birthDate: OptionalValue<string>;
  /**
   * Atributos cadastrais configurados (inclusive o antigo "sexo
   * administrativo", agora `attributeDefinitionId` + opção configurada).
   */
  civilAttributes: readonly CivilAttributeValue[];
  externalIdentifiers: readonly ExternalIdentifierReference[];
  provenance: StudentLifeProvenance;
};

// -------------------------------------------------------------------- Aluno

/**
 * Papel institucional da pessoa perante a Rede. É a própria materialização do
 * vínculo com a Rede Municipal — não existe entidade intermediária redundante.
 *
 * NÃO possui `firstNetworkAdmissionDate`: a data de primeiro ingresso é
 * PROJEÇÃO derivável do ledger (`getFirstNetworkAdmissionDate`).
 */
export type StudentRole = {
  studentId: InternalId;
  personId: InternalId;
  /** Identificador institucional exibível (número SIGEM). */
  institutionalIdentifier: InstitutionalIdentifier;
  /** Estado configurado do aluno perante a Rede (máquina de estados própria). */
  networkStateDefinitionId: string;
  /** Motivo configurado do estado atual, quando a definição o exigir. */
  networkStateReasonDefinitionId?: string;
  externalIdentifiers: readonly ExternalIdentifierReference[];
  provenance: StudentLifeProvenance;
};

// ----------------------------------------- Vínculo institucional com unidade

/**
 * Episódio de vigência do vínculo com a unidade. A existência de múltiplos
 * episódios permite representar RETORNO sem criar novo vínculo, quando a
 * política configurada assim determinar.
 */
export type BondValidityEpisode = {
  episodeId: InternalId;
  /** Data de eficácia do início do episódio (fato escolar). */
  validFrom: string;
  /** Data de eficácia do encerramento; `null` = episódio em curso. */
  validUntil: string | null;
  /** Motivo configurado do encerramento, quando encerrado. */
  closureReasonDefinitionId?: string;
  /** Evento do ledger que produziu a abertura deste episódio. */
  openedByEventId: InternalId;
  /** Evento do ledger que produziu o encerramento, quando houver. */
  closedByEventId?: InternalId;
};

/**
 * Relação institucional DURADOURA entre aluno e unidade escolar.
 * Não é "a matrícula de 2027": inscrição por ciclo letivo é 13B.
 *
 * Esta entidade é ESTADO/PROJEÇÃO institucional vigente; toda alteração
 * nasce de um evento do ledger (`sourceEventIds`).
 */
export type SchoolInstitutionalBond = {
  bondId: InternalId;
  studentId: InternalId;
  schoolId: string;
  /** Nome da unidade conforme registrado à época; o histórico não é reescrito. */
  schoolNameAtEstablishment: string;
  /** Número de registro exibível do vínculo (padrão configurável). */
  institutionalIdentifier: InstitutionalIdentifier;
  /** Estado configurado do vínculo (máquina de estados própria, distinta do aluno). */
  bondStateDefinitionId: string;
  bondStateReasonDefinitionId?: string;
  /** Episódios de vigência em ordem cronológica de eficácia. */
  episodes: readonly BondValidityEpisode[];
  /** Encadeamento quando a política optar por NOVO vínculo em vez de reativação. */
  precedingBondId?: string | null;
  supersededByBondId?: string | null;
  /** Eventos do ledger que produziram o estado atual desta entidade. */
  sourceEventIds: readonly InternalId[];
  provenance: StudentLifeProvenance;
};

// ------------------------------------------------ Participação (fundação)

/**
 * Natureza da participação educacional, declarada por configuração.
 * A 13A apenas fundamenta a coexistência; criação efetiva de participação e
 * alocação pertence a 13B/13C.
 */
export type ParticipationNatureDefinition = {
  natureDefinitionId: string;
  labelSnapshot: string;
  /** Escopo declarado (aberto): escolarização principal, complementar… */
  scopeId: string;
  /** Exige participação de escolarização principal simultânea? */
  requiresPrincipalParticipation?: boolean;
};

/** Declaração de compatibilidade entre naturezas — sem noção de horário. */
export type ParticipationCoexistenceRule = {
  ruleId: string;
  natureDefinitionIds: readonly string[];
  /** `true` = combinação declarada compatível; `false` = declarada incompatível. */
  compatible: boolean;
  /** Código estruturado do diagnóstico emitido quando incompatível. */
  diagnosticCode?: string;
  note?: string;
};

export type ParticipationCoexistencePolicy = {
  policyId: string;
  policyVersion: number;
  natures: readonly ParticipationNatureDefinition[];
  rules: readonly ParticipationCoexistenceRule[];
  /**
   * Combinação não declarada: a política diz o que fazer. Sem declaração o
   * motor devolve diagnóstico inconclusivo — nunca autoriza por omissão.
   */
  undeclaredCombinationStateId: "compatible" | "incompatible" | "inconclusive";
};

// ------------------------------------------------------- Ledger de eventos

/** Escopo estruturado do evento: o CIECE nunca interpreta texto livre. */
export type StudentLifeEventScope = {
  personId?: InternalId;
  studentId?: InternalId;
  bondId?: InternalId;
  schoolId?: string;
  /** Referências de contexto acadêmico, quando aplicável (13B em diante). */
  academicCycleId?: string;
  enrollmentId?: string;
  participationId?: string;
  classId?: string;
};

/**
 * Registro histórico imutável de um acontecimento da vida escolar.
 *
 * `attributes` NUNCA é livre: cada evento declara `payloadSchemaDefinitionId`,
 * e o schema correspondente define os campos esperados, seus tipos e sua
 * obrigatoriedade — mantendo os dados pesquisáveis e validáveis.
 */
export type StudentLifeEvent = {
  eventId: InternalId;
  /** Tipo do evento (aberto, declarado por configuração). */
  eventTypeDefinitionId: string;
  /** Contrato do payload deste evento. */
  payloadSchemaDefinitionId: string;
  scope: StudentLifeEventScope;
  /** Quando o fato escolar teve eficácia (ISO aaaa-mm-dd). */
  effectiveDate: string;
  /** Campos estruturados conforme o schema declarado. */
  attributes: Readonly<Record<string, string | number | boolean | null>>;
  /**
   * Representação HUMANA complementar. Nunca é a descrição canônica do fato e
   * nunca deve ser interpretada por nenhum consumidor.
   */
  summary?: string;
  /** Retificação: o registro anterior permanece íntegro no ledger. */
  isCorrection: boolean;
  precedingEventId?: InternalId | null;
  provenance: StudentLifeProvenance;
};

/** Definição do contrato de payload de um tipo de evento. */
export type EventPayloadSchemaDefinition = {
  payloadSchemaDefinitionId: string;
  fields: readonly {
    key: string;
    valueType: "string" | "number" | "boolean" | "isoDate";
    required: boolean;
  }[];
};

export type StudentLifeEventTypeDefinition = {
  eventTypeDefinitionId: string;
  labelSnapshot: string;
  payloadSchemaDefinitionId: string;
  /** Escopos obrigatórios para este tipo de evento. */
  requiredScopeKeys: readonly (keyof StudentLifeEventScope)[];
};

// -------------------------------------------------- Diagnósticos estruturados

/** Severidade estrutural; a apresentação decide cor, ícone e ordem. */
export type StudentLifeDiagnosticSeverity = "blocker" | "warning" | "requirement" | "info";

/**
 * Diagnóstico legível por máquina: `code` é o contrato, `message` é cortesia.
 * Permite consultas como "quantos vínculos bloqueados pelo mesmo requisito".
 */
export type StudentLifeDiagnostic = {
  code: string;
  typeId: string;
  severity: StudentLifeDiagnosticSeverity;
  scopeReference: StudentLifeEventScope;
  sourceReference?: { kind: string; id: string; version?: number };
  parameters?: Readonly<Record<string, string | number | boolean | null>>;
  /** Mensagem humana complementar, nunca critério de decisão. */
  message?: string;
};

export type StudentLifeValidationResult = {
  /** `null` = inconclusivo: faltou definição configurada para decidir. */
  allowed: boolean | null;
  diagnostics: readonly StudentLifeDiagnostic[];
};

// ------------------------------------------------ Estados e transições

export type StudentLifeStateDefinition = {
  stateDefinitionId: string;
  labelSnapshot: string;
  /** Máquina a que pertence (aberto): aluno-rede, vinculo-unidade, … */
  machineId: string;
  /** Estado terminal da máquina, quando a rede assim declarar. */
  terminal?: boolean;
};

export type StudentLifeTransitionDefinition = {
  transitionDefinitionId: string;
  machineId: string;
  fromStateDefinitionId: string;
  toStateDefinitionId: string;
  /** Tipo de evento que materializa a transição no ledger. */
  eventTypeDefinitionId: string;
  /** Motivos admitidos; vazio = motivo não exigido. */
  allowedReasonDefinitionIds?: readonly string[];
  reasonRequired?: boolean;
  /** Exigências formais estruturadas (códigos, nunca frases). */
  requirementTypeIds?: readonly string[];
  /** Exige ato institucional originador? */
  requiresInstitutionalAct?: boolean;
};

export type StudentLifeStateMachine = {
  machineId: string;
  states: readonly StudentLifeStateDefinition[];
  transitions: readonly StudentLifeTransitionDefinition[];
};

/** Política de retorno à mesma unidade: reativar episódio ou novo vínculo. */
export type BondReturnPolicy = {
  policyId: string;
  policyVersion: number;
  /**
   * `reactivate-episode` = novo episódio no mesmo vínculo.
   * `chain-new-bond`    = novo vínculo encadeado ao anterior.
   * `undefined`         = política não declarada; motor devolve inconclusivo.
   */
  returnStrategyId?: "reactivate-episode" | "chain-new-bond";
};

export type StudentLifeGovernanceConfiguration = {
  configurationId: string;
  configurationVersion: number;
  machines: readonly StudentLifeStateMachine[];
  eventTypes: readonly StudentLifeEventTypeDefinition[];
  payloadSchemas: readonly EventPayloadSchemaDefinition[];
  coexistencePolicy: ParticipationCoexistencePolicy;
  returnPolicy: BondReturnPolicy;
  /** Definições de atributos cadastrais e suas opções configuradas. */
  civilAttributeDefinitions: readonly {
    attributeDefinitionId: string;
    labelSnapshot: string;
    valueKind: "choice" | "text" | "number";
    optionDefinitionIds?: readonly string[];
  }[];
  /** Motivos de ausência reconhecidos (desconhecido, não informado, não aplicável…). */
  absenceReasonDefinitionIds: readonly string[];
};
