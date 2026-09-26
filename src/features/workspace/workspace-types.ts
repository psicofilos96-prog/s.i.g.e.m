/**
 * Etapa 13G — Workspace Projection Framework (contratos).
 *
 * PRINCÍPIO: portal não é domínio nem fonte de verdade. É PROJEÇÃO OPERACIONAL
 * AUTORIZADA sobre os domínios canônicos:
 *
 *   agente + capacidades efetivas + escopo institucional + finalidade + contexto
 *     → projeção operacional autorizada
 *
 * Nada aqui é entidade persistida: fila, caixa de trabalho, "aguardando ação",
 * "prazo próximo" e "concluído recentemente" são projeções reproduzíveis. A
 * autoridade NUNCA vem do nome de um perfil: vem de capacidades efetivas.
 */
import type {
  DossierEntityReference,
  DossierSubjectReference,
} from "@/features/student-life/dossier-types";

export const WORKSPACE_PROJECTION_SCHEMA_VERSION = 1;

export const WORKSPACE_MODULE_LABEL =
  "Projeção operacional de workspace (13G) — demonstrativa, sem norma homologada.";

// ------------------------------------------------------------- Contexto do ator

/**
 * Escopo institucional ABERTO. Nunca `schoolId`: um mesmo agente pode atuar em
 * várias unidades, em setores ou em escopo de Rede (13J aproveitará isso).
 */
export type InstitutionalScopeReference = DossierEntityReference;

/**
 * Contexto de acesso do ator. Não existe "papel" como autoridade: o que
 * autoriza são `capacityDefinitionIds` efetivas, o escopo e a finalidade.
 */
export type WorkspaceAccessContext = {
  actorId: string;
  capacityDefinitionIds: readonly string[];
  institutionalScopes: readonly InstitutionalScopeReference[];
  processingPurposeDefinitionId: string;
  /** Operação de leitura usada na decisão de acesso (13F). */
  readOperationDefinitionId: string;
  requestedAt: string;
  /** Requisitos já atendidos pelo ator (justificativa, autorização…). */
  satisfiedRequirementDefinitionIds?: readonly string[];
  contextAttributes?: Readonly<Record<string, unknown>>;
};

// -------------------------------------------------------- Fatos operacionais

export type WorkspaceSourceReference = {
  /** Natureza da fonte, resolvida por catálogo aberto. */
  sourceTypeDefinitionId: string;
  entityId: string;
  entityVersion?: number;
  /** Versão do esquema de projeção publicado pela fonte, quando houver. */
  sourceProjectionSchemaVersion?: number;
};

export type WorkspaceDeadline = {
  dueDate: string;
  deadlineOriginTypeDefinitionId: string;
  labelSnapshot?: string;
};

/** Diagnóstico produzido pelo DOMÍNIO responsável; o portal não reclassifica. */
export type WorkspaceRequirementDiagnostic = {
  diagnosticCode: string;
  requirementDefinitionId: string;
  messageSnapshot: string;
  /** Efeito institucional declarado pelo domínio (impede, permite com prazo…). */
  effectDefinitionId: string;
  effectLabelSnapshot?: string;
  sourceReference: WorkspaceSourceReference;
  policyId: string;
  policyVersion: number;
  /** Quem tem competência para resolver, segundo o domínio de origem. */
  competentExecutorDefinitionId: string;
  deadline?: WorkspaceDeadline;
  inconclusive?: boolean;
};

/** Primitivas de admissibilidade do processo (motor, não taxonomia). */
export const WORKSPACE_ADMISSIBILITY = {
  admissible: "admissivel",
  inadmissible: "inadmissivel",
  inconclusive: "inconclusiva",
} as const;
export type WorkspaceAdmissibility =
  (typeof WORKSPACE_ADMISSIBILITY)[keyof typeof WORKSPACE_ADMISSIBILITY];

/** Primitivas de autorização do agente (motor, não taxonomia). */
export const WORKSPACE_AUTHORIZATION = {
  authorized: "autorizada",
  notAuthorized: "nao-autorizada",
  inconclusive: "inconclusiva",
} as const;
export type WorkspaceAuthorization =
  (typeof WORKSPACE_AUTHORIZATION)[keyof typeof WORKSPACE_AUTHORIZATION];

/** Deep link para o objeto real que originou o item. */
export type WorkspaceDeepLink = {
  linkTargetDefinitionId: string;
  params: Readonly<Record<string, string>>;
  labelSnapshot: string;
};

/**
 * Operação declarada pelo domínio dono do processo: tecnicamente DISPONÍVEL.
 * A autorização do agente é calculada depois, separadamente.
 */
export type WorkspaceOperationDeclaration = {
  operationDefinitionId: string;
  labelSnapshot: string;
  /** Domínio que executa de fato (13B, 13C, 13D, 13F…), por identificador. */
  executingDomainId: string;
  admissibility: WorkspaceAdmissibility;
  /** Capacidades exigidas pela configuração para executar a operação. */
  requiredCapacityDefinitionIds: readonly string[];
  /** Impedimentos declarados pelo domínio, por extenso. */
  impedimentMessages?: readonly string[];
  deepLink?: WorkspaceDeepLink;
};

/**
 * Fato operacional publicado por um domínio canônico. O workspace LÊ; nunca
 * grava, nunca atribui estado próprio e nunca conta como fonte de verdade.
 */
export type WorkspaceOperationalFact = {
  /** Identidade determinística (fonte + entidade), só para projeção/UI. */
  factKey: string;
  processTypeDefinitionId: string;
  processStateDefinitionId: string;
  source: WorkspaceSourceReference;
  producedByDomainId: string;
  scopeEntities: readonly InstitutionalScopeReference[];
  subjectReferences: readonly DossierSubjectReference[];
  titleSnapshot: string;
  summary?: string;
  effectiveDate: string;
  recordedAt: string;
  concludedAt?: string;
  /** Quem a configuração declara como aguardado (setor, família, terceiro…). */
  awaitingPartyDefinitionId?: string;
  deadline?: WorkspaceDeadline;
  requirementDiagnostics?: readonly WorkspaceRequirementDiagnostic[];
  availableOperations?: readonly WorkspaceOperationDeclaration[];
  /** Sensibilidade e campos projetáveis, para a decisão de acesso da 13F. */
  sensitivityLevelDefinitionId: string;
  resourceKindDefinitionId: string;
  typeDefinitionId: string;
  projectableFieldPaths: readonly string[];
  payload: Readonly<Record<string, unknown>>;
  policyId?: string;
  policyVersion?: number;
  deepLink?: WorkspaceDeepLink;
};

// ------------------------------------------------------------- Filas abertas

/** Predicado de fila: executor registrado + parâmetros configurados. */
export type WorkspaceQueuePredicate = {
  predicateExecutorId: string;
  parameters?: Readonly<Record<string, unknown>>;
};

/**
 * Definição CADASTRÁVEL de caixa de trabalho. "Aguardando Secretaria",
 * "Prazo próximo" e "Concluído recentemente" são configuração, nunca enum.
 */
export type WorkspaceQueueDefinition = {
  queueDefinitionId: string;
  labelSnapshot: string;
  descriptionSnapshot?: string;
  order: number;
  /** Todos os predicados devem ser satisfeitos para o fato entrar na fila. */
  predicates: readonly WorkspaceQueuePredicate[];
};

/** Janela temporal de atenção, sempre configurada (nunca "7 dias" no código). */
export type WorkspaceTemporalWindowDefinition = {
  windowDefinitionId: string;
  labelSnapshot: string;
  days: number;
};

/** Item de fila: DERIVADO, com chave determinística e sem ciclo de vida próprio. */
export type OperationalQueueItem = {
  queueItemKey: string;
  queueDefinitionId: string;
  source: WorkspaceSourceReference;
  producedByDomainId: string;
  processTypeDefinitionId: string;
  processStateDefinitionId: string;
  titleSnapshot: string;
  summary?: string;
  subjectReferences: readonly DossierSubjectReference[];
  effectiveDate: string;
  recordedAt: string;
  concludedAt?: string;
  awaitingPartyDefinitionId?: string;
  deadline?: WorkspaceDeadline;
  actions: readonly WorkspaceActionDescriptor[];
  requirementDiagnostics: readonly WorkspaceRequirementDiagnostic[];
  deepLink?: WorkspaceDeepLink;
  authorizedPayload: Readonly<Record<string, unknown>>;
  redactedFieldPaths: readonly string[];
  policyId?: string;
  policyVersion?: number;
};

/**
 * Ação do workspace: explica operação, domínio executor, admissibilidade do
 * processo, autorização do agente e impedimento/requisito. Nunca "botão sumiu".
 */
export type WorkspaceActionDescriptor = {
  actionKey: string;
  operationDefinitionId: string;
  labelSnapshot: string;
  executingDomainId: string;
  processAdmissibility: WorkspaceAdmissibility;
  actorAuthorization: WorkspaceAuthorization;
  requiredCapacityDefinitionIds: readonly string[];
  missingCapacityDefinitionIds: readonly string[];
  impedimentMessages: readonly string[];
  /** Explicação por extenso de por que não é possível determinar/executar. */
  explanation: string;
  deepLink?: WorkspaceDeepLink;
};

// ------------------------------------------- Ficha integrada composicional

export type ProfileSectionEntry = {
  term: string;
  detailSnapshot: string;
  sourceReference?: WorkspaceSourceReference;
};

export type ProfileSectionResult = {
  sectionDefinitionId: string;
  labelSnapshot: string;
  order: number;
  entries: readonly ProfileSectionEntry[];
  actions: readonly WorkspaceActionDescriptor[];
  diagnostics: readonly string[];
};

export type ProfileSectionRequest = {
  subjectEntityId: string;
  context: WorkspaceAccessContext;
  /** Fatos JÁ autorizados; o provedor nunca recebe o que não foi liberado. */
  authorizedItems: readonly OperationalQueueItem[];
};

/** Provedor de seção registrado por domínio; o portal não conhece 13A–13F. */
export type ProfileSectionProvider = (
  request: ProfileSectionRequest,
) => ProfileSectionResult | null;

// ------------------------------------------------------------ Projeção final

export type WorkspaceQueueProjection = {
  definition: WorkspaceQueueDefinition;
  items: readonly OperationalQueueItem[];
  /** Contagem de navegação sobre a própria projeção (não é indicador). */
  itemCount: number;
};

export type WorkspaceConsultedSource = {
  sourceTypeDefinitionId: string;
  producedByDomainId: string;
  entityCount: number;
  sourceProjectionSchemaVersions: readonly number[];
};

export type WorkspaceProjection = {
  workspaceProjectionSchemaVersion: number;
  producedAt: string;
  workspacePerspectiveDefinitionId: string;
  actorId: string;
  institutionalScopes: readonly InstitutionalScopeReference[];
  processingPurposeDefinitionId: string;
  queues: readonly WorkspaceQueueProjection[];
  /** Agregação de diagnósticos dos domínios; sem catálogo próprio. */
  requirementMatrix: readonly WorkspaceRequirementDiagnostic[];
  authorizedItems: readonly OperationalQueueItem[];
  consultedSources: readonly WorkspaceConsultedSource[];
  accessPolicyId: string;
  accessPolicyVersion: number;
  diagnostics: readonly string[];
};
