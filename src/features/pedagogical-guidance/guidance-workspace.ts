/**
 * Etapa 13H — Perspectiva operacional DEMONSTRATIVA da Orientação Pedagógica.
 *
 * Segunda perspectiva institucional sobre o MESMO Workspace Projection Framework
 * da 13G: nada no motor conhece "Orientação". O que muda são capacidades,
 * escopo, finalidade, filas configuradas, processos registrados e seções da ficha.
 *
 * Portal não é domínio nem fonte de verdade: filas, contagens, pendências e
 * visões de turma são projeções autorizadas — nunca segunda verdade institucional.
 */
import { formatAcademicDate, civilDateOf } from "@/lib/academic-date";
import { DOSSIER_ACCESS_EXECUTOR_IDS } from "@/features/student-life/dossier-access";
import type { DossierAccessPolicy } from "@/features/student-life/dossier-types";
import { demonstrationStudents } from "@/features/students/students-data";
import {
  createProcessRegistry,
  createProfileSectionRegistry,
  projectIntegratedProfile,
  projectProcessFacts,
  projectWorkspace,
  registerProcessType,
  registerProfileSection,
  WORKSPACE_PREDICATE_EXECUTOR_IDS,
  type WorkspaceProcessRegistry,
  type WorkspaceProcessSourceInput,
} from "@/features/workspace/workspace-engine";
import type { SearchableSubjectDescriptor } from "@/features/workspace/workspace-search";
import {
  WORKSPACE_ADMISSIBILITY,
  type OperationalQueueItem,
  type ProfileSectionResult,
  type WorkspaceAccessContext,
  type WorkspaceOperationalFact,
  type WorkspaceProjection,
  type WorkspaceQueueDefinition,
  type WorkspaceTemporalWindowDefinition,
} from "@/features/workspace/workspace-types";
import {
  currentPlanVersion,
  casesForSubject,
  projectCaseState,
  projectReferralStatus,
  responsibleAssignmentsAsOf,
} from "./guidance-cases";
import {
  demonstrationCaseEvents,
  demonstrationCaseResponsibilities,
  demonstrationCases,
  demonstrationPlanVersions,
  demonstrationReferralPolicy,
  demonstrationReferrals,
  demonstrationReferralResponses,
  demonstrationSignalLifecycleEvents,
  GUIDANCE_CAPACITIES,
  GUIDANCE_CASE_STATES,
  GUIDANCE_DOMAIN_IDS,
  GUIDANCE_LINK_TARGETS,
  GUIDANCE_OPERATIONS,
  GUIDANCE_PROCESS_TYPES,
  GUIDANCE_PURPOSES,
  GUIDANCE_SCOPE_KINDS,
  GUIDANCE_SENSITIVITY,
  GUIDANCE_SIGNAL_STATES,
  GUIDANCE_SOURCE_TYPES,
} from "./guidance-fixtures";
import { buildDemonstrationSignalOccurrences } from "./guidance-signals-demo";
import type {
  PedagogicalFollowUpCase,
  PedagogicalSignalOccurrence,
  ReferralRecord,
} from "./guidance-types";

export const GUIDANCE_PERSPECTIVE_ID = "perspectiva-orientacao-pedagogica-demo";

export const GUIDANCE_AWAITING_PARTIES = {
  guidance: "aguardando-orientacao-pedagogica",
  thirdParty: "aguardando-terceiro-ou-destino",
  family: "aguardando-familia-ou-responsavel",
} as const;

// ------------------------------------------------ Janelas e filas (configuração)

export const guidanceTemporalWindows: readonly WorkspaceTemporalWindowDefinition[] = [
  {
    windowDefinitionId: "janela-prazo-de-acao-demo",
    labelSnapshot: "Janela de atenção a prazos de ação (demonstrativa)",
    days: 20,
  },
  {
    windowDefinitionId: "janela-atualizacao-recente-demo",
    labelSnapshot: "Janela de atualizações recentes (demonstrativa)",
    days: 30,
  },
];

export const guidanceQueues: readonly WorkspaceQueueDefinition[] = [
  {
    queueDefinitionId: "fila-sinais-aguardando-analise-demo",
    labelSnapshot: "Sinais aguardando análise",
    descriptionSnapshot:
      "Ocorrências de sinal cuja análise institucional ainda não foi registrada. Sinal não é diagnóstico nem abertura de acompanhamento.",
    order: 1,
    predicates: [
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.processTypeIn,
        parameters: { processTypeDefinitionIds: [GUIDANCE_PROCESS_TYPES.signalAnalysis] },
      },
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.stateIn,
        parameters: {
          stateDefinitionIds: [
            GUIDANCE_SIGNAL_STATES.current,
            GUIDANCE_SIGNAL_STATES.underAnalysis,
          ],
        },
      },
    ],
  },
  {
    queueDefinitionId: "fila-acompanhamentos-ativos-demo",
    labelSnapshot: "Acompanhamentos em curso",
    order: 2,
    predicates: [
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.processTypeIn,
        parameters: { processTypeDefinitionIds: [GUIDANCE_PROCESS_TYPES.followUpCase] },
      },
      { predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.notConcluded },
    ],
  },
  {
    queueDefinitionId: "fila-acoes-com-prazo-demo",
    labelSnapshot: "Ações com prazo próximo",
    order: 3,
    predicates: [
      { predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.notConcluded },
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.deadlineWithinWindow,
        parameters: { windowDefinitionId: "janela-prazo-de-acao-demo" },
      },
    ],
  },
  {
    queueDefinitionId: "fila-encaminhamentos-aguardando-resposta-demo",
    labelSnapshot: "Encaminhamentos aguardando resposta",
    order: 4,
    predicates: [
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.processTypeIn,
        parameters: { processTypeDefinitionIds: [GUIDANCE_PROCESS_TYPES.referral] },
      },
      { predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.notConcluded },
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.awaitingParty,
        parameters: {
          awaitingPartyDefinitionIds: [GUIDANCE_AWAITING_PARTIES.thirdParty],
        },
      },
    ],
  },
  {
    queueDefinitionId: "fila-atualizados-recentemente-demo",
    labelSnapshot: "Atualizados recentemente",
    order: 5,
    predicates: [
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.concludedWithinWindow,
        parameters: { windowDefinitionId: "janela-atualizacao-recente-demo" },
      },
    ],
  },
];

// ------------------------------------------------------ Política de acesso (13F)

export const guidanceAccessPolicy: DossierAccessPolicy = {
  policyId: "pol-acesso-orientacao-demo",
  policyVersion: 1,
  validFrom: "2027-01-01",
  validUntil: null,
  homologated: true,
  rules: [
    {
      ruleId: "regra-conteudo-restrito-de-acompanhamento",
      priority: 10,
      match: {
        capacityDefinitionIds: [GUIDANCE_CAPACITIES.readGuidanceContent],
        sensitivityLevelDefinitionIds: [GUIDANCE_SENSITIVITY.restricted],
        processingPurposeDefinitionIds: [GUIDANCE_PURPOSES.pedagogicalFollowUp],
        requiresScopeIntersection: true,
      },
      effect: {
        accessEffectDefinitionId: "efeito-conceder-com-auditoria-demo",
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantWithAudit,
      },
    },
    {
      ruleId: "regra-metadado-institucional-com-supressao",
      priority: 20,
      match: {
        capacityDefinitionIds: [GUIDANCE_CAPACITIES.consultPedagogicalPath],
        sensitivityLevelDefinitionIds: [GUIDANCE_SENSITIVITY.institutional],
        requiresScopeIntersection: true,
      },
      effect: {
        accessEffectDefinitionId: "efeito-suprimir-fundamentacao-demo",
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantRedacted,
        parameters: {
          redactedFieldPaths: ["fundamentacao"],
          requiresAuditRecord: true,
        },
      },
    },
  ],
  defaultEffect: {
    accessEffectDefinitionId: "efeito-nao-disponibilizar-demo",
    executorId: DOSSIER_ACCESS_EXECUTOR_IDS.withhold,
  },
};

// -------------------------------------------------- Adaptadores de processo

const studentLabel = (studentId: string): string =>
  demonstrationStudents.find((student) => student.id === studentId)?.personName ?? studentId;

const scopeOf = (
  entities: readonly { entityKindDefinitionId: string; entityId: string }[],
) => entities.map((entity) => ({ ...entity }));

function signalFactAdapter(raw: unknown): WorkspaceOperationalFact | null {
  const occurrence = raw as PedagogicalSignalOccurrence;
  if (!occurrence?.occurrenceId) return null;
  const lifecycle = demonstrationSignalLifecycleEvents
    .filter((event) => event.occurrenceId === occurrence.occurrenceId)
    .slice()
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  const state =
    lifecycle.length > 0
      ? (lifecycle[lifecycle.length - 1]?.toStateDefinitionId ?? GUIDANCE_SIGNAL_STATES.current)
      : GUIDANCE_SIGNAL_STATES.current;
  return {
    factKey: `${GUIDANCE_SOURCE_TYPES.signalOccurrence}::${occurrence.occurrenceId}`,
    processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.signalAnalysis,
    processStateDefinitionId: state,
    source: {
      sourceTypeDefinitionId: GUIDANCE_SOURCE_TYPES.signalOccurrence,
      entityId: occurrence.occurrenceId,
      entityVersion: occurrence.definitionVersion,
      sourceProjectionSchemaVersion: 1,
    },
    producedByDomainId: GUIDANCE_DOMAIN_IDS.guidance,
    scopeEntities: scopeOf(occurrence.scopeEntities),
    subjectReferences: occurrence.subjects,
    titleSnapshot: `Sinal de atenção detectado pela configuração vigente na época`,
    summary:
      "Condição configurada apurada sobre fatos canônicos. Não constitui diagnóstico, rótulo nem abertura de acompanhamento.",
    effectiveDate: civilDateOf(occurrence.materializedAt),
    recordedAt: occurrence.provenance.recordedAt,
    awaitingPartyDefinitionId: GUIDANCE_AWAITING_PARTIES.guidance,
    availableOperations: [
      {
        operationDefinitionId: GUIDANCE_OPERATIONS.analyseSignal,
        labelSnapshot: "Registrar análise do sinal",
        executingDomainId: GUIDANCE_DOMAIN_IDS.guidance,
        admissibility: WORKSPACE_ADMISSIBILITY.admissible,
        requiredCapacityDefinitionIds: [GUIDANCE_CAPACITIES.analyseSignal],
      },
      {
        operationDefinitionId: GUIDANCE_OPERATIONS.openCase,
        labelSnapshot: "Abrir acompanhamento a partir deste sinal",
        executingDomainId: GUIDANCE_DOMAIN_IDS.guidance,
        admissibility: WORKSPACE_ADMISSIBILITY.admissible,
        requiredCapacityDefinitionIds: [GUIDANCE_CAPACITIES.openFollowUpCase],
      },
    ],
    sensitivityLevelDefinitionId: occurrence.sensitivityLevelDefinitionId,
    resourceKindDefinitionId: "ocorrencia-de-sinal",
    typeDefinitionId: occurrence.signalDefinitionId,
    projectableFieldPaths: ["sinal", "versaoDaDefinicao", "estado", "fundamentacao"],
    payload: {
      sinal: occurrence.signalDefinitionId,
      versaoDaDefinicao: occurrence.definitionVersion,
      estado: state,
      fundamentacao: occurrence.factSnapshot
        .map((fact) => `${fact.factKey}=${String(fact.value)}`)
        .join("; "),
    },
    deepLink: {
      linkTargetDefinitionId: GUIDANCE_LINK_TARGETS.studentProfile,
      params: { alunoId: occurrence.subjects[0]?.reference.entityId ?? "" },
      labelSnapshot: "Abrir ficha pedagógica do estudante",
    },
  };
}

function caseFactAdapter(raw: unknown): WorkspaceOperationalFact | null {
  const followUpCase = raw as PedagogicalFollowUpCase;
  if (!followUpCase?.caseId) return null;
  const state = projectCaseState({
    followUpCase,
    events: demonstrationCaseEvents,
    asOf: "2027-05-10",
  });
  const plan = currentPlanVersion(demonstrationPlanVersions, "plano-demo-001");
  const dueDate =
    followUpCase.caseId === "caso-demo-001"
      ? plan?.items.find((item) => item.dueDate !== undefined)?.dueDate
      : undefined;
  const responsible = responsibleAssignmentsAsOf(
    demonstrationCaseResponsibilities,
    followUpCase.caseId,
    "2027-05-10",
  );
  return {
    factKey: `acompanhamento::${followUpCase.caseId}`,
    processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.followUpCase,
    processStateDefinitionId: state.stateDefinitionId,
    source: {
      sourceTypeDefinitionId: "acompanhamento-pedagogico-13h",
      entityId: followUpCase.caseId,
      sourceProjectionSchemaVersion: 1,
    },
    producedByDomainId: GUIDANCE_DOMAIN_IDS.guidance,
    scopeEntities: scopeOf(followUpCase.scopeEntities),
    subjectReferences: followUpCase.subjects,
    titleSnapshot: `Acompanhamento pedagógico aberto em ${formatAcademicDate(followUpCase.openedOn)}`,
    summary:
      followUpCase.subjects.length > 1
        ? "Acompanhamento com múltiplos sujeitos, conforme a política configurada."
        : "Acompanhamento individual referenciando os fatos que o fundamentaram.",
    effectiveDate: followUpCase.openedOn,
    recordedAt: followUpCase.provenance.recordedAt,
    ...(state.concluded && state.concludedOn ? { concludedAt: state.concludedOn } : {}),
    ...(state.concluded ? {} : { awaitingPartyDefinitionId: GUIDANCE_AWAITING_PARTIES.guidance }),
    ...(dueDate
      ? {
          deadline: {
            dueDate,
            deadlineOriginTypeDefinitionId: "prazo-declarado-no-plano",
            labelSnapshot: "Prazo declarado em item do plano vigente",
          },
        }
      : {}),
    availableOperations: [
      {
        operationDefinitionId: GUIDANCE_OPERATIONS.registerIntervention,
        labelSnapshot: "Registrar intervenção",
        executingDomainId: GUIDANCE_DOMAIN_IDS.guidance,
        admissibility: state.concluded
          ? WORKSPACE_ADMISSIBILITY.inadmissible
          : WORKSPACE_ADMISSIBILITY.admissible,
        requiredCapacityDefinitionIds: [GUIDANCE_CAPACITIES.registerIntervention],
        ...(state.concluded
          ? {
              impedimentMessages: [
                "O acompanhamento está encerrado segundo o ledger; encerrar não significa resolvido, mas impede novo registro sem reabertura.",
              ],
            }
          : {}),
      },
      {
        operationDefinitionId: GUIDANCE_OPERATIONS.issueReferral,
        labelSnapshot: "Encaminhar a outro contexto institucional",
        executingDomainId: GUIDANCE_DOMAIN_IDS.guidance,
        admissibility: WORKSPACE_ADMISSIBILITY.admissible,
        requiredCapacityDefinitionIds: [GUIDANCE_CAPACITIES.issueReferral],
      },
    ],
    sensitivityLevelDefinitionId: followUpCase.sensitivityLevelDefinitionId,
    resourceKindDefinitionId: "acompanhamento-pedagogico",
    typeDefinitionId: followUpCase.openingModeDefinitionId,
    projectableFieldPaths: ["estado", "abertura", "responsavel", "fundamentacao"],
    payload: {
      estado: state.stateDefinitionId,
      abertura: followUpCase.openingModeDefinitionId,
      responsavel:
        responsible[0]?.agentReference.agentNameSnapshot ??
        responsible[0]?.agentReference.agentId ??
        "sem responsabilidade vigente registrada",
      fundamentacao: followUpCase.foundingReferences
        .map((reference) => `${reference.sourceTypeDefinitionId}:${reference.entityId}`)
        .join("; "),
    },
    deepLink: {
      linkTargetDefinitionId: GUIDANCE_LINK_TARGETS.studentProfile,
      params: { alunoId: followUpCase.subjects[0]?.reference.entityId ?? "" },
      labelSnapshot: "Abrir ficha pedagógica do estudante",
    },
  };
}

function referralFactAdapter(raw: unknown): WorkspaceOperationalFact | null {
  const referral = raw as ReferralRecord;
  if (!referral?.referralId) return null;
  const status = projectReferralStatus({
    referral,
    policy: demonstrationReferralPolicy,
    responses: demonstrationReferralResponses,
  });
  return {
    factKey: `encaminhamento::${referral.referralId}`,
    processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.referral,
    processStateDefinitionId: status.awaitingResponse
      ? "encaminhamento-aguardando-resposta"
      : "encaminhamento-sem-pendencia-de-resposta",
    source: {
      sourceTypeDefinitionId: "encaminhamento-13h",
      entityId: referral.referralId,
      sourceProjectionSchemaVersion: 1,
    },
    producedByDomainId: GUIDANCE_DOMAIN_IDS.guidance,
    scopeEntities: [
      { entityKindDefinitionId: GUIDANCE_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
    ],
    subjectReferences:
      demonstrationCases.find((item) => item.caseId === referral.caseId)?.subjects ?? [],
    titleSnapshot: `Encaminhamento emitido em ${formatAcademicDate(referral.issuedAt)}`,
    summary: referral.reasonSnapshot,
    effectiveDate: referral.issuedAt,
    recordedAt: referral.provenance.recordedAt,
    ...(status.awaitingResponse
      ? { awaitingPartyDefinitionId: GUIDANCE_AWAITING_PARTIES.thirdParty }
      : {}),
    ...(status.responseDueDate
      ? {
          deadline: {
            dueDate: status.responseDueDate,
            deadlineOriginTypeDefinitionId: "prazo-da-politica-de-encaminhamento",
          },
        }
      : {}),
    ...(status.diagnostics.length > 0
      ? {
          requirementDiagnostics: status.diagnostics.map((diagnostic) => ({
            diagnosticCode: diagnostic.diagnosticCode,
            requirementDefinitionId: "req-expectativa-de-retorno",
            messageSnapshot: diagnostic.messageSnapshot,
            effectDefinitionId: "efeito-inconclusivo",
            sourceReference: {
              sourceTypeDefinitionId: "encaminhamento-13h",
              entityId: referral.referralId,
            },
            policyId: referral.referralPolicyId,
            policyVersion: referral.referralPolicyVersion,
            competentExecutorDefinitionId: "executor-orientacao-pedagogica",
            inconclusive: true,
          })),
        }
      : {}),
    availableOperations: [],
    sensitivityLevelDefinitionId: referral.sensitivityLevelDefinitionId,
    resourceKindDefinitionId: "encaminhamento-institucional",
    typeDefinitionId: referral.referralTypeDefinitionId,
    projectableFieldPaths: ["destino", "expectativa", "fundamentacao"],
    payload: {
      destino: referral.destinationReference.labelSnapshot ?? referral.destinationReference.entityId,
      expectativa: status.responseExpectationDefinitionId ?? "não configurada",
      fundamentacao: referral.reasonSnapshot,
    },
  };
}

export function createGuidanceProcessRegistry(): WorkspaceProcessRegistry {
  const registry = createProcessRegistry();
  registerProcessType(registry, {
    processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.signalAnalysis,
    labelSnapshot: "Análise de sinal de atenção",
    executingDomainId: GUIDANCE_DOMAIN_IDS.guidance,
    projectionAdapter: signalFactAdapter,
  });
  registerProcessType(registry, {
    processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.followUpCase,
    labelSnapshot: "Acompanhamento pedagógico",
    executingDomainId: GUIDANCE_DOMAIN_IDS.guidance,
    projectionAdapter: caseFactAdapter,
  });
  registerProcessType(registry, {
    processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.referral,
    labelSnapshot: "Encaminhamento institucional",
    executingDomainId: GUIDANCE_DOMAIN_IDS.guidance,
    projectionAdapter: referralFactAdapter,
  });
  return registry;
}

export function guidanceProcessSources(): readonly WorkspaceProcessSourceInput[] {
  return [
    {
      processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.signalAnalysis,
      entities: buildDemonstrationSignalOccurrences(),
    },
    {
      processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.followUpCase,
      entities: demonstrationCases,
    },
    {
      processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.referral,
      entities: demonstrationReferrals,
    },
  ];
}

// --------------------------------------------------- Sujeitos pesquisáveis

export const guidanceSearchableSubjects: readonly SearchableSubjectDescriptor[] =
  demonstrationStudents
    .filter((student) => student.currentUnitId !== null)
    .map((student) => ({
      subjectEntityId: student.id,
      subjectTypeDefinitionId: "aluno",
      scopeEntities: [
        {
          entityKindDefinitionId: GUIDANCE_SCOPE_KINDS.schoolUnit,
          entityId: student.currentUnitId ?? "",
        },
      ],
      attributes: [
        {
          attributeDefinitionId: "nome-da-pessoa",
          labelSnapshot: "Nome",
          value: student.personName,
          requiredCapacityDefinitionIds: [GUIDANCE_CAPACITIES.consultPedagogicalPath],
        },
        {
          attributeDefinitionId: "identificador-institucional",
          labelSnapshot: "Identificador institucional",
          value: student.sigemId,
          requiredCapacityDefinitionIds: [GUIDANCE_CAPACITIES.consultPedagogicalPath],
          institutionalIdentifier: true,
        },
      ],
      deepLink: {
        linkTargetDefinitionId: GUIDANCE_LINK_TARGETS.studentProfile,
        params: { alunoId: student.id },
        labelSnapshot: `Abrir ficha pedagógica de ${student.personName}`,
      },
    }));

// ----------------------------------------- Seções da ficha (registro aberto)

export function createGuidanceProfileSectionRegistry() {
  const registry = createProfileSectionRegistry();

  registerProfileSection(registry, {
    sectionDefinitionId: "secao-percurso-e-fatos-canonicos",
    provider: ({ subjectEntityId }): ProfileSectionResult => ({
      sectionDefinitionId: "secao-percurso-e-fatos-canonicos",
      labelSnapshot: "Percurso e fatos canônicos referenciados",
      order: 1,
      entries: [
        {
          term: "Estudante",
          detailSnapshot: studentLabel(subjectEntityId),
        },
        {
          term: "Fonte acadêmica",
          detailSnapshot:
            "Resultados e frequência são lidos da publicação canônica do percurso; a Orientação não os recalcula nem os grava.",
        },
      ],
      actions: [],
      diagnostics: [],
    }),
  });

  const fromProcess = (input: {
    sectionDefinitionId: string;
    labelSnapshot: string;
    order: number;
    processTypeDefinitionId: string;
    emptySnapshot: string;
  }) =>
    registerProfileSection(registry, {
      sectionDefinitionId: input.sectionDefinitionId,
      provider: ({ authorizedItems }): ProfileSectionResult => {
        const items = authorizedItems.filter(
          (item) => item.processTypeDefinitionId === input.processTypeDefinitionId,
        );
        return {
          sectionDefinitionId: input.sectionDefinitionId,
          labelSnapshot: input.labelSnapshot,
          order: input.order,
          entries:
            items.length > 0
              ? items.map((item) => ({
                  term: item.titleSnapshot,
                  detailSnapshot: `${formatAcademicDate(item.effectiveDate)} · ${String(
                    item.authorizedPayload["estado"] ?? item.processStateDefinitionId,
                  )}`,
                  sourceReference: item.source,
                }))
              : [
                  {
                    term: "Sem registro autorizado",
                    detailSnapshot: input.emptySnapshot,
                  },
                ],
          actions: items.flatMap((item) => item.actions),
          diagnostics: [],
        };
      },
    });

  fromProcess({
    sectionDefinitionId: "secao-sinais-de-atencao",
    labelSnapshot: "Sinais de atenção",
    order: 2,
    processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.signalAnalysis,
    emptySnapshot:
      "Nenhum sinal autorizado nesta finalidade. Ausência de sinal não significa ausência de necessidade.",
  });

  fromProcess({
    sectionDefinitionId: "secao-acompanhamentos",
    labelSnapshot: "Acompanhamentos, planos e intervenções",
    order: 3,
    processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.followUpCase,
    emptySnapshot:
      "Nenhum acompanhamento autorizado nesta finalidade. Ausência de acompanhamento não afirma que está tudo bem.",
  });

  fromProcess({
    sectionDefinitionId: "secao-encaminhamentos",
    labelSnapshot: "Encaminhamentos",
    order: 4,
    processTypeDefinitionId: GUIDANCE_PROCESS_TYPES.referral,
    emptySnapshot: "Nenhum encaminhamento autorizado nesta finalidade.",
  });

  return registry;
}

// -------------------------------------------------------------- Composição

export function createGuidanceAccessContext(input?: {
  capacityDefinitionIds?: readonly string[];
  institutionalScopeIds?: readonly string[];
  requestedAt?: string;
  processingPurposeDefinitionId?: string;
}): WorkspaceAccessContext {
  return {
    actorId: "agente-orientacao-demo",
    capacityDefinitionIds:
      input?.capacityDefinitionIds ?? [
        GUIDANCE_CAPACITIES.consultPedagogicalPath,
        GUIDANCE_CAPACITIES.readGuidanceContent,
        GUIDANCE_CAPACITIES.analyseSignal,
        GUIDANCE_CAPACITIES.openFollowUpCase,
        GUIDANCE_CAPACITIES.registerIntervention,
      ],
    institutionalScopes: (input?.institutionalScopeIds ?? ["demo-001", "tur-001"]).map(
      (entityId) => ({
        entityKindDefinitionId: GUIDANCE_SCOPE_KINDS.schoolUnit,
        entityId,
      }),
    ),
    processingPurposeDefinitionId:
      input?.processingPurposeDefinitionId ?? GUIDANCE_PURPOSES.pedagogicalFollowUp,
    readOperationDefinitionId: GUIDANCE_OPERATIONS.readPedagogicalMetadata,
    requestedAt: input?.requestedAt ?? "2027-03-20T12:00:00.000Z",
  };
}

export function buildGuidanceWorkspaceProjection(input?: {
  context?: WorkspaceAccessContext;
  sources?: readonly WorkspaceProcessSourceInput[];
  queueDefinitions?: readonly WorkspaceQueueDefinition[];
  temporalWindows?: readonly WorkspaceTemporalWindowDefinition[];
  accessPolicy?: DossierAccessPolicy;
}): WorkspaceProjection {
  const context = input?.context ?? createGuidanceAccessContext();
  const projected = projectProcessFacts({
    sources: input?.sources ?? guidanceProcessSources(),
    registry: createGuidanceProcessRegistry(),
  });
  return projectWorkspace({
    workspacePerspectiveDefinitionId: GUIDANCE_PERSPECTIVE_ID,
    context,
    accessPolicy: input?.accessPolicy ?? guidanceAccessPolicy,
    facts: projected.facts,
    queueDefinitions: input?.queueDefinitions ?? guidanceQueues,
    temporalWindows: input?.temporalWindows ?? guidanceTemporalWindows,
    producedAt: context.requestedAt,
    upstreamDiagnostics: projected.diagnostics,
  });
}

export function buildGuidanceStudentProfile(input: {
  subjectEntityId: string;
  context?: WorkspaceAccessContext;
}) {
  const context = input.context ?? createGuidanceAccessContext();
  const projection = buildGuidanceWorkspaceProjection({ context });
  return {
    projection,
    ...projectIntegratedProfile({
      subjectEntityId: input.subjectEntityId,
      context,
      projection,
      registry: createGuidanceProfileSectionRegistry(),
    }),
  };
}

// -------------------------------------------------- Projeção da turma (entrada)

export type GuidanceClassStudentProjection = {
  subjectEntityId: string;
  displaySnapshot: string;
  /** Itens de acompanhamento que o agente está AUTORIZADO a conhecer. */
  authorizedItems: readonly OperationalQueueItem[];
};

export type GuidanceClassProjection = {
  workspaceProjectionSchemaVersion: number;
  producedAt: string;
  classId: string;
  students: readonly GuidanceClassStudentProjection[];
  diagnostics: readonly string[];
};

/**
 * Turma como PORTA DE ENTRADA operacional: "quais estudantes possuem itens de
 * acompanhamento que estou autorizado a conhecer?" — nunca taxa, gráfico,
 * ranking ou "quais alunos têm problemas" (isso é CIECE, Capítulo 14).
 */
export function projectGuidanceClassView(input: {
  classId: string;
  context?: WorkspaceAccessContext;
  projection?: WorkspaceProjection;
}): GuidanceClassProjection {
  const context = input.context ?? createGuidanceAccessContext();
  const projection = input.projection ?? buildGuidanceWorkspaceProjection({ context });
  const byStudent = new Map<string, OperationalQueueItem[]>();
  for (const item of projection.authorizedItems) {
    const inClass = item.subjectReferences.length > 0;
    if (!inClass) continue;
    for (const subject of item.subjectReferences) {
      if (subject.reference.entityKindDefinitionId !== "aluno") continue;
      const list = byStudent.get(subject.reference.entityId) ?? [];
      list.push(item);
      byStudent.set(subject.reference.entityId, list);
    }
  }
  const students = demonstrationStudents
    .filter((student) => student.currentClassId === input.classId)
    .map((student) => ({
      subjectEntityId: student.id,
      displaySnapshot: student.personName,
      authorizedItems: byStudent.get(student.id) ?? [],
    }));
  return {
    workspaceProjectionSchemaVersion: projection.workspaceProjectionSchemaVersion,
    producedAt: projection.producedAt,
    classId: input.classId,
    students,
    diagnostics: projection.diagnostics,
  };
}

// ------------------------------------------- Fatos atômicos ao CIECE (13H)

export type GuidanceAnalyticFact = {
  factKey: string;
  factTypeDefinitionId: string;
  subjectEntityIds: readonly string[];
  effectiveDate: string;
  /** Somente existência temporal e natureza; nunca conteúdo protegido. */
  attributes: Readonly<Record<string, string | number | boolean>>;
};

/**
 * Exposição analítica: fatos ATÔMICOS autorizáveis. Nenhum texto de atendimento,
 * fundamentação sensível, motivo confidencial ou agregação é publicado — quem
 * conta e cruza é o CIECE, sob sua própria política.
 */
export function projectGuidanceAnalyticFacts(input?: {
  context?: WorkspaceAccessContext;
  projection?: WorkspaceProjection;
}): readonly GuidanceAnalyticFact[] {
  const context = input?.context ?? createGuidanceAccessContext();
  const projection = input?.projection ?? buildGuidanceWorkspaceProjection({ context });
  return projection.authorizedItems.map((item) => ({
    factKey: `fato-analitico::${item.source.sourceTypeDefinitionId}::${item.source.entityId}`,
    factTypeDefinitionId: item.processTypeDefinitionId,
    subjectEntityIds: item.subjectReferences.map((subject) => subject.reference.entityId),
    effectiveDate: item.effectiveDate,
    attributes: {
      estado: item.processStateDefinitionId,
      concluido: item.concludedAt !== undefined,
      producidoPor: item.producedByDomainId,
    },
  }));
}

export function guidanceQueueItems(
  projection: WorkspaceProjection,
  queueDefinitionId: string,
): readonly OperationalQueueItem[] {
  return (
    projection.queues.find((queue) => queue.definition.queueDefinitionId === queueDefinitionId)
      ?.items ?? []
  );
}

export { casesForSubject, GUIDANCE_CASE_STATES };
