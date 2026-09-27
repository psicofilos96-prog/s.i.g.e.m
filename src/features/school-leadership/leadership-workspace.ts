/**
 * Etapa 13I — Perspectiva institucional DEMONSTRATIVA da Direção Escolar.
 *
 * Terceira perspectiva sobre o MESMO Workspace Projection Framework (13G): nada
 * no motor conhece "Direção". O que muda são capacidades, escopo, finalidade,
 * filas configuradas, processos registrados e seções da ficha.
 *
 * PRINCÍPIO: hierarquia organizacional não implica autorização informacional nem
 * competência operacional. O cargo jamais autoriza; autoriza a capacidade
 * explícita, com escopo, vigência, finalidade e política aplicável.
 *
 * FRONTEIRA COM O CIECE (Cap. 14): aqui só existem ESTADO e CONFORMIDADE de
 * objetos concretos ("3 turmas com impedimento de encerramento"). Nenhuma taxa,
 * série histórica, ranking, gráfico ou indicador de desempenho.
 */
import { DOSSIER_ACCESS_EXECUTOR_IDS } from "@/features/student-life/dossier-access";
import type {
  DossierAccessPolicy,
  DossierEntityReference,
} from "@/features/student-life/dossier-types";
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
import { formatAcademicDate } from "@/lib/academic-date";
import {
  assessDecisionProcess,
  currentDecisionRecord,
  type DecisionAssessment,
} from "@/features/institutional-decisions/decision-engine";
import {
  demonstrationClosingImpediments,
  demonstrationCompetenceGrants,
  demonstrationDecisionProcesses,
  demonstrationDecisionProcessTypes,
  demonstrationGuidanceReferralsToLeadership,
  LEADERSHIP_AWAITING_PARTIES,
  LEADERSHIP_CAPACITIES,
  LEADERSHIP_DOMAIN_IDS,
  LEADERSHIP_ESCALATION_REASONS,
  LEADERSHIP_LINK_TARGETS,
  LEADERSHIP_OPERATIONS,
  LEADERSHIP_PROCESS_TYPES,
  LEADERSHIP_PURPOSES,
  LEADERSHIP_SCOPE_KINDS,
  LEADERSHIP_SENSITIVITY,
  LEADERSHIP_SOURCE_TYPES,
  type LeadershipClosingImpediment,
  type LeadershipGuidanceReferral,
} from "@/features/institutional-decisions/decision-fixtures";
import type {
  InstitutionalCompetenceGrant,
  InstitutionalDecisionProcess,
  InstitutionalDecisionRecord,
} from "@/features/institutional-decisions/decision-types";

export const LEADERSHIP_PERSPECTIVE_ID = "perspectiva-direcao-escolar-demo";

export const LEADERSHIP_MODULE_LABEL =
  "Portal da Direção Escolar (13I) — projeção institucional demonstrativa, sem norma homologada da Rede.";

// ------------------------------------------- Estados de processo (configurados)

export const LEADERSHIP_PROCESS_STATES = {
  awaitingDecision: "aguardando-decisao-institucional",
  decided: "decidido",
  returnedForCorrection: "devolvido-para-correcao",
  impedimentOpen: "impedimento-em-aberto",
  referralReceived: "encaminhamento-recebido",
} as const;

// -------------------------------------------------- Janelas e filas (configuração)

export const leadershipTemporalWindows: readonly WorkspaceTemporalWindowDefinition[] = [
  {
    windowDefinitionId: "janela-prazo-institucional-demo",
    labelSnapshot: "Janela de atenção a prazos institucionais (demonstrativa)",
    days: 25,
  },
  {
    windowDefinitionId: "janela-atos-recentes-demo",
    labelSnapshot: "Janela de atos recentemente concluídos (demonstrativa)",
    days: 30,
  },
];

export const leadershipQueues: readonly WorkspaceQueueDefinition[] = [
  {
    queueDefinitionId: "fila-processos-aguardando-decisao-demo",
    labelSnapshot: "Processos aguardando decisão institucional",
    descriptionSnapshot:
      "Cada processo declara a regra que exige a decisão, os fatos considerados e as alternativas admissíveis. Nada é decidido por clique isolado.",
    order: 1,
    predicates: [
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.processTypeIn,
        parameters: {
          processTypeDefinitionIds: [LEADERSHIP_PROCESS_TYPES.institutionalDecision],
        },
      },
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.stateIn,
        parameters: {
          stateDefinitionIds: [LEADERSHIP_PROCESS_STATES.awaitingDecision],
        },
      },
    ],
  },
  {
    queueDefinitionId: "fila-excecoes-alem-da-secretaria-demo",
    labelSnapshot: "Exceções que ultrapassaram a competência da Secretaria",
    order: 2,
    predicates: [
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.processTypeIn,
        parameters: {
          processTypeDefinitionIds: [LEADERSHIP_PROCESS_TYPES.institutionalDecision],
        },
      },
      {
        predicateExecutorId: "motivo-de-escalonamento-em",
        parameters: {
          escalationReasonDefinitionIds: [
            LEADERSHIP_ESCALATION_REASONS.beyondSecretaryCompetence,
          ],
        },
      },
    ],
  },
  {
    queueDefinitionId: "fila-encaminhamentos-da-orientacao-demo",
    labelSnapshot: "Casos encaminhados pela Orientação",
    descriptionSnapshot:
      "A Direção recebe a providência administrativa solicitada; conteúdo pedagógico confidencial permanece com quem possui a capacidade específica.",
    order: 3,
    predicates: [
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.processTypeIn,
        parameters: {
          processTypeDefinitionIds: [LEADERSHIP_PROCESS_TYPES.guidanceReferral],
        },
      },
    ],
  },
  {
    queueDefinitionId: "fila-pendencias-de-encerramento-demo",
    labelSnapshot: "Pendências de encerramento de períodos e ciclos",
    order: 4,
    predicates: [
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.processTypeIn,
        parameters: {
          processTypeDefinitionIds: [LEADERSHIP_PROCESS_TYPES.closingImpediment],
        },
      },
      { predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.notConcluded },
    ],
  },
  {
    queueDefinitionId: "fila-prazos-institucionais-demo",
    labelSnapshot: "Prazos institucionais em curso",
    order: 5,
    predicates: [
      { predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.notConcluded },
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.deadlineWithinWindow,
        parameters: { windowDefinitionId: "janela-prazo-institucional-demo" },
      },
    ],
  },
  {
    queueDefinitionId: "fila-processos-devolvidos-demo",
    labelSnapshot: "Processos devolvidos para correção",
    order: 6,
    predicates: [
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.stateIn,
        parameters: {
          stateDefinitionIds: [LEADERSHIP_PROCESS_STATES.returnedForCorrection],
        },
      },
    ],
  },
  {
    queueDefinitionId: "fila-atos-recentemente-concluidos-demo",
    labelSnapshot: "Atos recentemente concluídos",
    order: 7,
    predicates: [
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.concludedWithinWindow,
        parameters: { windowDefinitionId: "janela-atos-recentes-demo" },
      },
    ],
  },
];

/** Predicado adicional registrado pela perspectiva, sem alterar o núcleo. */
export const LEADERSHIP_PREDICATE_EXECUTOR_IDS = {
  escalationReasonIn: "motivo-de-escalonamento-em",
} as const;

// ------------------------------------------------------ Política de acesso (13F)

export const leadershipAccessPolicy: DossierAccessPolicy = {
  policyId: "pol-acesso-direcao-demo",
  policyVersion: 1,
  validFrom: "2027-01-01",
  validUntil: null,
  homologated: true,
  rules: [
    {
      ruleId: "regra-conteudo-restrito-com-capacidade-especifica",
      priority: 10,
      match: {
        capacityDefinitionIds: [LEADERSHIP_CAPACITIES.readGuidanceRestrictedContent],
        sensitivityLevelDefinitionIds: [LEADERSHIP_SENSITIVITY.restricted],
        processingPurposeDefinitionIds: [LEADERSHIP_PURPOSES.institutionalManagement],
        requiresScopeIntersection: true,
      },
      effect: {
        accessEffectDefinitionId: "efeito-conceder-com-auditoria-demo",
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantWithAudit,
      },
    },
    {
      ruleId: "regra-conteudo-restrito-sem-capacidade-especifica",
      priority: 20,
      match: {
        capacityDefinitionIds: [LEADERSHIP_CAPACITIES.consultInstitutionalState],
        sensitivityLevelDefinitionIds: [LEADERSHIP_SENSITIVITY.restricted],
        requiresScopeIntersection: true,
      },
      effect: {
        accessEffectDefinitionId: "efeito-suprimir-conteudo-confidencial-demo",
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantRedacted,
        parameters: {
          redactedFieldPaths: ["conteudoConfidencial"],
          requiresAuditRecord: true,
        },
      },
    },
    {
      ruleId: "regra-estado-institucional-da-unidade",
      priority: 30,
      match: {
        capacityDefinitionIds: [LEADERSHIP_CAPACITIES.consultInstitutionalState],
        sensitivityLevelDefinitionIds: [LEADERSHIP_SENSITIVITY.institutional],
        requiresScopeIntersection: true,
      },
      effect: {
        accessEffectDefinitionId: "efeito-conceder-integralmente-demo",
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantAll,
      },
    },
  ],
  defaultEffect: {
    accessEffectDefinitionId: "efeito-nao-disponibilizar-demo",
    executorId: DOSSIER_ACCESS_EXECUTOR_IDS.withhold,
  },
};

// ------------------------------------------------------- Adaptadores de processo

const unitScope = (unitId: string): DossierEntityReference => ({
  entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit,
  entityId: unitId,
});

const typeDefinitionOf = (id: string) =>
  demonstrationDecisionProcessTypes.find(
    (definition) => definition.decisionProcessTypeDefinitionId === id,
  );

/** Estado do processo decisório DERIVADO da cadeia de decisões, nunca persistido. */
export function projectDecisionProcessState(input: {
  process: InstitutionalDecisionProcess;
  decisions: readonly InstitutionalDecisionRecord[];
}): { stateDefinitionId: string; concludedAt?: string } {
  const current = currentDecisionRecord(input.decisions, input.process.decisionProcessId);
  if (!current) return { stateDefinitionId: LEADERSHIP_PROCESS_STATES.awaitingDecision };
  if (
    current.chosenAlternativeDefinitionId === "alternativa-devolver-para-correcao"
  ) {
    return {
      stateDefinitionId: LEADERSHIP_PROCESS_STATES.returnedForCorrection,
    };
  }
  return {
    stateDefinitionId: LEADERSHIP_PROCESS_STATES.decided,
    concludedAt: current.effectiveDate,
  };
}

function decisionProcessAdapter(input: {
  decisions: readonly InstitutionalDecisionRecord[];
  grants: readonly InstitutionalCompetenceGrant[];
  agentId: string;
  isoDate: string;
}) {
  return (raw: unknown): WorkspaceOperationalFact | null => {
    const process = raw as InstitutionalDecisionProcess;
    if (!process?.decisionProcessId) return null;
    const typeDefinition = typeDefinitionOf(process.decisionProcessTypeDefinitionId);
    const state = projectDecisionProcessState({ process, decisions: input.decisions });

    let assessment: DecisionAssessment | null = null;
    if (typeDefinition) {
      assessment = assessDecisionProcess({
        process,
        typeDefinition,
        grants: input.grants,
        agentId: input.agentId,
        isoDate: input.isoDate,
      });
    }

    return {
      factKey: `${LEADERSHIP_SOURCE_TYPES.decisionProcess}::${process.decisionProcessId}`,
      processTypeDefinitionId: LEADERSHIP_PROCESS_TYPES.institutionalDecision,
      processStateDefinitionId: state.stateDefinitionId,
      source: {
        sourceTypeDefinitionId: LEADERSHIP_SOURCE_TYPES.decisionProcess,
        entityId: process.decisionProcessId,
        sourceProjectionSchemaVersion: 1,
      },
      producedByDomainId: LEADERSHIP_DOMAIN_IDS.institutionalDecision,
      scopeEntities: process.scopeEntities,
      subjectReferences: process.subjectReferences,
      titleSnapshot:
        typeDefinition?.labelSnapshot ?? "Processo decisório sem tipo configurado",
      summary: process.escalationNarrativeSnapshot,
      effectiveDate: process.openedOn,
      recordedAt: process.provenance.recordedAt,
      ...(state.concludedAt ? { concludedAt: state.concludedAt } : {}),
      ...(state.concludedAt
        ? {}
        : { awaitingPartyDefinitionId: LEADERSHIP_AWAITING_PARTIES.leadership }),
      ...(process.deadline
        ? {
            deadline: {
              dueDate: process.deadline.dueDate,
              deadlineOriginTypeDefinitionId:
                process.deadline.deadlineOriginTypeDefinitionId,
              labelSnapshot: "Prazo declarado pela política que exige a decisão",
            },
          }
        : {}),
      ...(assessment && assessment.diagnostics.length > 0
        ? {
            requirementDiagnostics: assessment.diagnostics.map((message, index) => ({
              diagnosticCode: `diagnostico-decisao-${index + 1}`,
              requirementDefinitionId: "req-fatos-da-decisao",
              messageSnapshot: message,
              effectDefinitionId: "efeito-inconclusivo",
              sourceReference: {
                sourceTypeDefinitionId: LEADERSHIP_SOURCE_TYPES.decisionProcess,
                entityId: process.decisionProcessId,
              },
              policyId: assessment.requiringPolicyId,
              policyVersion: assessment.requiringPolicyVersion,
              competentExecutorDefinitionId: "executor-direcao-escolar",
              inconclusive: true,
            })),
          }
        : {}),
      availableOperations: (typeDefinition?.alternatives ?? []).map((alternative) => {
        const detail = assessment?.alternatives.find(
          (entry) => entry.alternativeDefinitionId === alternative.alternativeDefinitionId,
        );
        const admissible =
          assessment?.admissibleAlternativeDefinitionIds.includes(
            alternative.alternativeDefinitionId,
          ) ?? false;
        return {
          operationDefinitionId: alternative.alternativeDefinitionId,
          labelSnapshot: alternative.labelSnapshot,
          executingDomainId: LEADERSHIP_DOMAIN_IDS.institutionalDecision,
          admissibility: admissible
            ? WORKSPACE_ADMISSIBILITY.admissible
            : detail && detail.admissibility === "alternativa-inconclusiva"
              ? WORKSPACE_ADMISSIBILITY.inconclusive
              : WORKSPACE_ADMISSIBILITY.inadmissible,
          requiredCapacityDefinitionIds: alternative.requiredCapacityDefinitionIds,
          ...(detail && !admissible
            ? { impedimentMessages: [detail.explanation] }
            : {}),
        };
      }),
      sensitivityLevelDefinitionId: process.sensitivityLevelDefinitionId,
      resourceKindDefinitionId: "processo-decisorio",
      typeDefinitionId: process.decisionProcessTypeDefinitionId,
      projectableFieldPaths: [
        "objeto",
        "motivoDeChegada",
        "regraQueExige",
        "fatosConsiderados",
        "alternativasAdmissiveis",
        "efeitoInstitucional",
      ],
      payload: {
        objeto: process.objectReferences
          .map((reference) => reference.labelSnapshot ?? reference.entityId)
          .join("; "),
        motivoDeChegada: process.escalationReasonDefinitionId,
        regraQueExige:
          typeDefinition?.requirementNarrativeSnapshot ??
          "Regra exigente não localizada na configuração.",
        fatosConsiderados: process.consideredFacts
          .map(
            (fact) =>
              `${fact.labelSnapshot}: ${
                fact.availability === "disponivel"
                  ? String(fact.valueSnapshot)
                  : "não disponível"
              }`,
          )
          .join(" · "),
        alternativasAdmissiveis:
          (assessment?.admissibleAlternativeDefinitionIds.length ?? 0) > 0
            ? (assessment?.admissibleAlternativeDefinitionIds ?? []).join("; ")
            : "nenhuma alternativa admissível para este agente nesta data",
        efeitoInstitucional:
          typeDefinition?.actNatureDefinitionId ?? "natureza de ato não configurada",
      },
      policyId: typeDefinition?.requiringPolicyId ?? "",
      ...(typeDefinition ? { policyVersion: typeDefinition.requiringPolicyVersion } : {}),
      ...(process.subjectReferences[0]
        ? {
            deepLink: {
              linkTargetDefinitionId: LEADERSHIP_LINK_TARGETS.studentProfile,
              params: {
                alunoId: process.subjectReferences[0].reference.entityId,
              },
              labelSnapshot: "Abrir o objeto real da decisão",
            },
          }
        : {}),
    };
  };
}

function closingImpedimentAdapter(raw: unknown): WorkspaceOperationalFact | null {
  const impediment = raw as LeadershipClosingImpediment;
  if (!impediment?.impedimentId) return null;
  return {
    factKey: `${LEADERSHIP_SOURCE_TYPES.closingImpediment}::${impediment.impedimentId}`,
    processTypeDefinitionId: LEADERSHIP_PROCESS_TYPES.closingImpediment,
    processStateDefinitionId: LEADERSHIP_PROCESS_STATES.impedimentOpen,
    source: {
      sourceTypeDefinitionId: LEADERSHIP_SOURCE_TYPES.closingImpediment,
      entityId: impediment.impedimentId,
      sourceProjectionSchemaVersion: 1,
    },
    producedByDomainId: "dominio-encerramento-12k",
    scopeEntities: [
      unitScope(impediment.unitId),
      { entityKindDefinitionId: "turma", entityId: impediment.classId },
    ],
    subjectReferences: [],
    titleSnapshot: `${impediment.classLabelSnapshot}: impedimento de encerramento`,
    summary: impediment.messageSnapshot,
    effectiveDate: impediment.effectiveDate,
    recordedAt: impediment.recordedAt,
    awaitingPartyDefinitionId: impediment.inconclusive
      ? LEADERSHIP_AWAITING_PARTIES.secretary
      : LEADERSHIP_AWAITING_PARTIES.leadership,
    requirementDiagnostics: [
      {
        diagnosticCode: `impedimento-${impediment.impedimentId}`,
        requirementDefinitionId: impediment.requirementDefinitionId,
        messageSnapshot: impediment.messageSnapshot,
        effectDefinitionId: impediment.effectDefinitionId,
        sourceReference: {
          sourceTypeDefinitionId: LEADERSHIP_SOURCE_TYPES.closingImpediment,
          entityId: impediment.impedimentId,
        },
        policyId: impediment.policyId,
        policyVersion: impediment.policyVersion,
        competentExecutorDefinitionId: impediment.competentExecutorDefinitionId,
        ...(impediment.inconclusive ? { inconclusive: true } : {}),
      },
    ],
    availableOperations: [],
    sensitivityLevelDefinitionId: LEADERSHIP_SENSITIVITY.institutional,
    resourceKindDefinitionId: "pendencia-de-encerramento",
    typeDefinitionId: impediment.requirementDefinitionId,
    projectableFieldPaths: ["turma", "exigencia", "efeito", "competente"],
    payload: {
      turma: impediment.classLabelSnapshot,
      exigencia: impediment.messageSnapshot,
      efeito: impediment.effectDefinitionId,
      competente: impediment.competentExecutorDefinitionId,
    },
    policyId: impediment.policyId,
    policyVersion: impediment.policyVersion,
    deepLink: {
      linkTargetDefinitionId: LEADERSHIP_LINK_TARGETS.classClosing,
      params: { turmaId: impediment.classId },
      labelSnapshot: "Abrir o encerramento da turma",
    },
  };
}

function guidanceReferralAdapter(raw: unknown): WorkspaceOperationalFact | null {
  const referral = raw as LeadershipGuidanceReferral;
  if (!referral?.referralId) return null;
  return {
    factKey: `${LEADERSHIP_SOURCE_TYPES.guidanceReferral}::${referral.referralId}`,
    processTypeDefinitionId: LEADERSHIP_PROCESS_TYPES.guidanceReferral,
    processStateDefinitionId: LEADERSHIP_PROCESS_STATES.referralReceived,
    source: {
      sourceTypeDefinitionId: LEADERSHIP_SOURCE_TYPES.guidanceReferral,
      entityId: referral.referralId,
      sourceProjectionSchemaVersion: 1,
    },
    producedByDomainId: "dominio-orientacao-pedagogica-13h",
    scopeEntities: [unitScope(referral.unitId)],
    subjectReferences: [
      {
        subjectRoleDefinitionId: "papel-titular",
        reference: { entityKindDefinitionId: "aluno", entityId: referral.studentId },
      },
    ],
    titleSnapshot: "Encaminhamento recebido da Orientação Pedagógica",
    summary: referral.administrativeRequestSnapshot,
    effectiveDate: referral.issuedAt,
    recordedAt: referral.recordedAt,
    awaitingPartyDefinitionId: LEADERSHIP_AWAITING_PARTIES.leadership,
    availableOperations: [],
    sensitivityLevelDefinitionId: referral.sensitivityLevelDefinitionId,
    resourceKindDefinitionId: "encaminhamento-institucional",
    typeDefinitionId: "encaminhamento-para-providencia-administrativa",
    projectableFieldPaths: ["providenciaSolicitada", "conteudoConfidencial"],
    payload: {
      providenciaSolicitada: referral.administrativeRequestSnapshot,
      conteudoConfidencial: referral.confidentialContentSnapshot,
    },
    deepLink: {
      linkTargetDefinitionId: LEADERSHIP_LINK_TARGETS.studentProfile,
      params: { alunoId: referral.studentId },
      labelSnapshot: "Abrir o estudante referido",
    },
  };
}

export function createLeadershipProcessRegistry(input?: {
  decisions?: readonly InstitutionalDecisionRecord[];
  grants?: readonly InstitutionalCompetenceGrant[];
  agentId?: string;
  isoDate?: string;
}): WorkspaceProcessRegistry {
  const registry = createProcessRegistry();
  registerProcessType(registry, {
    processTypeDefinitionId: LEADERSHIP_PROCESS_TYPES.institutionalDecision,
    labelSnapshot: "Processo decisório institucional",
    executingDomainId: LEADERSHIP_DOMAIN_IDS.institutionalDecision,
    projectionAdapter: decisionProcessAdapter({
      decisions: input?.decisions ?? [],
      grants: input?.grants ?? demonstrationCompetenceGrants,
      agentId: input?.agentId ?? "agente-direcao-a",
      isoDate: input?.isoDate ?? "2027-05-10",
    }),
  });
  registerProcessType(registry, {
    processTypeDefinitionId: LEADERSHIP_PROCESS_TYPES.closingImpediment,
    labelSnapshot: "Pendência de encerramento",
    executingDomainId: "dominio-encerramento-12k",
    projectionAdapter: closingImpedimentAdapter,
  });
  registerProcessType(registry, {
    processTypeDefinitionId: LEADERSHIP_PROCESS_TYPES.guidanceReferral,
    labelSnapshot: "Encaminhamento recebido da Orientação",
    executingDomainId: "dominio-orientacao-pedagogica-13h",
    projectionAdapter: guidanceReferralAdapter,
  });
  return registry;
}

export function leadershipProcessSources(): readonly WorkspaceProcessSourceInput[] {
  return [
    {
      processTypeDefinitionId: LEADERSHIP_PROCESS_TYPES.institutionalDecision,
      entities: demonstrationDecisionProcesses,
    },
    {
      processTypeDefinitionId: LEADERSHIP_PROCESS_TYPES.closingImpediment,
      entities: demonstrationClosingImpediments,
    },
    {
      processTypeDefinitionId: LEADERSHIP_PROCESS_TYPES.guidanceReferral,
      entities: demonstrationGuidanceReferralsToLeadership,
    },
  ];
}

// ------------------------------------------------------ Sujeitos pesquisáveis

export const leadershipSearchableSubjects: readonly SearchableSubjectDescriptor[] =
  demonstrationStudents
    .filter((student) => student.currentUnitId !== null)
    .map((student) => ({
      subjectEntityId: student.id,
      subjectTypeDefinitionId: "aluno",
      scopeEntities: [unitScope(student.currentUnitId ?? "")],
      attributes: [
        {
          attributeDefinitionId: "nome-da-pessoa",
          labelSnapshot: "Nome",
          value: student.personName,
          requiredCapacityDefinitionIds: [
            LEADERSHIP_CAPACITIES.consultInstitutionalState,
          ],
        },
        {
          attributeDefinitionId: "identificador-institucional",
          labelSnapshot: "Identificador institucional",
          value: student.sigemId,
          requiredCapacityDefinitionIds: [
            LEADERSHIP_CAPACITIES.consultInstitutionalState,
          ],
          institutionalIdentifier: true,
        },
      ],
      deepLink: {
        linkTargetDefinitionId: LEADERSHIP_LINK_TARGETS.studentProfile,
        params: { alunoId: student.id },
        labelSnapshot: `Abrir ${student.personName} na perspectiva da Direção`,
      },
    }));

// ------------------------------------------ Seções da ficha (registro aberto)

export function createLeadershipProfileSectionRegistry() {
  const registry = createProfileSectionRegistry();

  registerProfileSection(registry, {
    sectionDefinitionId: "secao-processos-institucionais-do-estudante",
    provider: ({ authorizedItems }): ProfileSectionResult => {
      const items = authorizedItems.filter(
        (item) =>
          item.processTypeDefinitionId === LEADERSHIP_PROCESS_TYPES.institutionalDecision,
      );
      return {
        sectionDefinitionId: "secao-processos-institucionais-do-estudante",
        labelSnapshot: "Processos institucionais relacionados",
        order: 1,
        entries:
          items.length > 0
            ? items.map((item) => ({
                term: item.titleSnapshot,
                detailSnapshot: `${formatAcademicDate(item.effectiveDate)} · ${item.processStateDefinitionId}`,
                sourceReference: item.source,
              }))
            : [
                {
                  term: "Sem processo autorizado",
                  detailSnapshot:
                    "Nenhum processo institucional autorizado nesta finalidade. Ausência de processo não afirma ausência de necessidade.",
                },
              ],
        actions: items.flatMap((item) => item.actions),
        diagnostics: [],
      };
    },
  });

  registerProfileSection(registry, {
    sectionDefinitionId: "secao-encaminhamentos-recebidos",
    provider: ({ authorizedItems }): ProfileSectionResult => {
      const items = authorizedItems.filter(
        (item) =>
          item.processTypeDefinitionId === LEADERSHIP_PROCESS_TYPES.guidanceReferral,
      );
      return {
        sectionDefinitionId: "secao-encaminhamentos-recebidos",
        labelSnapshot: "Encaminhamentos recebidos pela Direção",
        order: 2,
        entries:
          items.length > 0
            ? items.map((item) => ({
                term: item.titleSnapshot,
                detailSnapshot: String(
                  item.authorizedPayload["providenciaSolicitada"] ??
                    "Providência não autorizada nesta finalidade.",
                ),
                sourceReference: item.source,
              }))
            : [
                {
                  term: "Sem encaminhamento autorizado",
                  detailSnapshot:
                    "Conteúdo pedagógico confidencial permanece com quem possui a capacidade específica; a hierarquia não confere acesso.",
                },
              ],
        actions: [],
        diagnostics: [
          "A Direção pode ver menos do que a Orientação para a mesma pessoa: acesso decorre de capacidade e finalidade, nunca de hierarquia.",
        ],
      };
    },
  });

  return registry;
}

// -------------------------------------------------------------- Composição

export function createLeadershipAccessContext(input?: {
  actorId?: string;
  capacityDefinitionIds?: readonly string[];
  institutionalScopeIds?: readonly string[];
  requestedAt?: string;
  processingPurposeDefinitionId?: string;
}): WorkspaceAccessContext {
  return {
    actorId: input?.actorId ?? "agente-direcao-a",
    capacityDefinitionIds:
      input?.capacityDefinitionIds ?? [
        LEADERSHIP_CAPACITIES.consultInstitutionalState,
        LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
        LEADERSHIP_CAPACITIES.returnForCorrection,
      ],
    institutionalScopes: (input?.institutionalScopeIds ?? ["demo-001"]).map(unitScope),
    processingPurposeDefinitionId:
      input?.processingPurposeDefinitionId ?? LEADERSHIP_PURPOSES.institutionalManagement,
    readOperationDefinitionId: LEADERSHIP_OPERATIONS.readInstitutionalMetadata,
    requestedAt: input?.requestedAt ?? "2027-05-10T12:00:00.000Z",
  };
}

/**
 * Predicado adicional da perspectiva: motivo de escalonamento. Entra por
 * REGISTRO sobre os executores nativos, sem substituir nenhum deles.
 */
function createLeadershipPredicateRegistry(
  processes: readonly InstitutionalDecisionProcess[],
): WorkspaceQueuePredicateRegistry {
  const reasonByEntityId = new Map(
    processes.map((process) => [
      process.decisionProcessId,
      process.escalationReasonDefinitionId,
    ]),
  );
  const registry = createQueuePredicateRegistry();
  registerQueuePredicateExecutor(
    registry,
    LEADERSHIP_PREDICATE_EXECUTOR_IDS.escalationReasonIn,
    ({ fact, parameters }) => {
      const declared = parameters["escalationReasonDefinitionIds"];
      if (!Array.isArray(declared)) return false;
      const reason = reasonByEntityId.get(fact.source.entityId);
      return reason !== undefined && declared.includes(reason);
    },
  );
  return registry;
}

export function buildLeadershipWorkspaceProjection(input?: {
  context?: WorkspaceAccessContext;
  sources?: readonly WorkspaceProcessSourceInput[];
  queueDefinitions?: readonly WorkspaceQueueDefinition[];
  temporalWindows?: readonly WorkspaceTemporalWindowDefinition[];
  accessPolicy?: DossierAccessPolicy;
  decisions?: readonly InstitutionalDecisionRecord[];
  grants?: readonly InstitutionalCompetenceGrant[];
  processRegistry?: WorkspaceProcessRegistry;
  decisionProcesses?: readonly InstitutionalDecisionProcess[];
}): WorkspaceProjection {
  const context = input?.context ?? createLeadershipAccessContext();
  const isoDate = context.requestedAt.slice(0, 10);
  const registry =
    input?.processRegistry ??
    createLeadershipProcessRegistry({
      ...(input?.decisions ? { decisions: input.decisions } : {}),
      ...(input?.grants ? { grants: input.grants } : {}),
      agentId: context.actorId,
      isoDate,
    });
  const projected = projectProcessFacts({
    sources: input?.sources ?? leadershipProcessSources(),
    registry,
  });

  return projectWorkspace({
    workspacePerspectiveDefinitionId: LEADERSHIP_PERSPECTIVE_ID,
    context,
    accessPolicy: input?.accessPolicy ?? leadershipAccessPolicy,
    facts: projected.facts,
    queueDefinitions: input?.queueDefinitions ?? leadershipQueues,
    temporalWindows: input?.temporalWindows ?? leadershipTemporalWindows,
    predicateRegistry: createLeadershipPredicateRegistry(
      input?.decisionProcesses ?? demonstrationDecisionProcesses,
    ),
    producedAt: context.requestedAt,
    upstreamDiagnostics: projected.diagnostics,
  });
}


export function buildLeadershipStudentProfile(input: {
  subjectEntityId: string;
  context?: WorkspaceAccessContext;
  projection?: WorkspaceProjection;
}) {
  const context = input.context ?? createLeadershipAccessContext();
  const projection =
    input.projection ?? buildLeadershipWorkspaceProjection({ context });
  return {
    projection,
    ...projectIntegratedProfile({
      subjectEntityId: input.subjectEntityId,
      context,
      projection,
      registry: createLeadershipProfileSectionRegistry(),
    }),
  };
}

// --------------------------------- Visão institucional / conformidade da unidade

export type LeadershipComplianceStatement = {
  statementKey: string;
  labelSnapshot: string;
  /** Contagem de OBJETOS concretos autorizados; nunca taxa nem indicador. */
  objectCount: number;
  objectReferences: readonly DossierEntityReference[];
  sourceTypeDefinitionIds: readonly string[];
};

/**
 * Estado e conformidade operacional da unidade, derivados apenas dos itens
 * AUTORIZADOS: uma fila nunca revela, por contagem, objeto que o agente não
 * pode conhecer.
 */
export function projectLeadershipUnitCompliance(input: {
  projection: WorkspaceProjection;
}): readonly LeadershipComplianceStatement[] {
  const items = input.projection.authorizedItems;

  const impedimentItems = items.filter(
    (item) =>
      item.processTypeDefinitionId === LEADERSHIP_PROCESS_TYPES.closingImpediment,
  );
  const classesWithImpediment = new Map<string, DossierEntityReference>();
  const inconclusiveClasses = new Map<string, DossierEntityReference>();
  for (const item of impedimentItems) {
    const classId = item.deepLink?.params["turmaId"];
    if (!classId) continue;
    const reference: DossierEntityReference = {
      entityKindDefinitionId: "turma",
      entityId: classId,
      labelSnapshot: String(item.authorizedPayload["turma"] ?? classId),
    };
    if (item.requirementDiagnostics.some((diagnostic) => diagnostic.inconclusive)) {
      inconclusiveClasses.set(classId, reference);
    } else {
      classesWithImpediment.set(classId, reference);
    }
  }

  const awaitingDecision = items.filter(
    (item) =>
      item.processTypeDefinitionId === LEADERSHIP_PROCESS_TYPES.institutionalDecision &&
      item.processStateDefinitionId === LEADERSHIP_PROCESS_STATES.awaitingDecision,
  );
  const withDeadline = items.filter((item) => item.deadline !== undefined);

  return [
    {
      statementKey: "conformidade-turmas-com-impedimento",
      labelSnapshot: "turmas com impedimento declarado para encerramento",
      objectCount: classesWithImpediment.size,
      objectReferences: [...classesWithImpediment.values()],
      sourceTypeDefinitionIds: [LEADERSHIP_SOURCE_TYPES.closingImpediment],
    },
    {
      statementKey: "conformidade-turmas-com-fechamento-inconclusivo",
      labelSnapshot: "turmas com fechamento inconclusivo, sem valor presumido",
      objectCount: inconclusiveClasses.size,
      objectReferences: [...inconclusiveClasses.values()],
      sourceTypeDefinitionIds: [LEADERSHIP_SOURCE_TYPES.closingImpediment],
    },
    {
      statementKey: "conformidade-processos-aguardando-decisao",
      labelSnapshot: "processos institucionais aguardando decisão",
      objectCount: awaitingDecision.length,
      objectReferences: awaitingDecision.map((item) => ({
        entityKindDefinitionId: "processo-decisorio",
        entityId: item.source.entityId,
        labelSnapshot: item.titleSnapshot,
      })),
      sourceTypeDefinitionIds: [LEADERSHIP_SOURCE_TYPES.decisionProcess],
    },
    {
      statementKey: "conformidade-prazos-institucionais",
      labelSnapshot: "objetos com prazo institucional em curso",
      objectCount: withDeadline.length,
      objectReferences: withDeadline.map((item) => ({
        entityKindDefinitionId: item.source.sourceTypeDefinitionId,
        entityId: item.source.entityId,
        labelSnapshot: item.titleSnapshot,
      })),
      sourceTypeDefinitionIds: [
        ...new Set(withDeadline.map((item) => item.source.sourceTypeDefinitionId)),
      ],
    },
  ];
}

// ------------------------------------------- Navegação institucional derivada

export type LeadershipNavigationNode = {
  nodeKey: string;
  labelSnapshot: string;
  /** Itens autorizados vinculados ao nó; nenhum dado é copiado. */
  itemCount: number;
  children: readonly LeadershipNavigationNode[];
  deepLinkTargetDefinitionId?: string;
  deepLinkParams?: Readonly<Record<string, string>>;
};

/** Árvore de navegação para o objeto real; nunca cópia de dado do domínio. */
export function projectLeadershipNavigationTree(input: {
  projection: WorkspaceProjection;
  unitLabelSnapshot: string;
}): LeadershipNavigationNode {
  const items = input.projection.authorizedItems;
  const byClass = new Map<string, { label: string; count: number }>();
  for (const item of items) {
    const classId = item.deepLink?.params["turmaId"];
    if (!classId) continue;
    const existing = byClass.get(classId);
    byClass.set(classId, {
      label: String(item.authorizedPayload["turma"] ?? classId),
      count: (existing?.count ?? 0) + 1,
    });
  }
  return {
    nodeKey: "no-unidade",
    labelSnapshot: input.unitLabelSnapshot,
    itemCount: items.length,
    children: [
      {
        nodeKey: "no-turmas",
        labelSnapshot: "Turmas",
        itemCount: [...byClass.values()].reduce((total, entry) => total + entry.count, 0),
        children: [...byClass.entries()].map(([classId, entry]) => ({
          nodeKey: `no-turma-${classId}`,
          labelSnapshot: entry.label,
          itemCount: entry.count,
          children: [],
          deepLinkTargetDefinitionId: LEADERSHIP_LINK_TARGETS.classClosing,
          deepLinkParams: { turmaId: classId },
        })),
      },
      {
        nodeKey: "no-processos-institucionais",
        labelSnapshot: "Processos institucionais",
        itemCount: items.filter(
          (item) =>
            item.processTypeDefinitionId ===
            LEADERSHIP_PROCESS_TYPES.institutionalDecision,
        ).length,
        children: [],
      },
      {
        nodeKey: "no-acompanhamentos",
        labelSnapshot: "Acompanhamentos encaminhados",
        itemCount: items.filter(
          (item) =>
            item.processTypeDefinitionId === LEADERSHIP_PROCESS_TYPES.guidanceReferral,
        ).length,
        children: [],
      },
    ],
  };
}

// ---------------------------------- Histórico institucional (projeção, sem ledger)

export type LeadershipTimelineEntry = {
  entryKey: string;
  effectiveDate: string;
  recordedAt: string;
  labelSnapshot: string;
  detailSnapshot: string;
  sourceTypeDefinitionId: string;
  entityId: string;
  supersedesEntityId?: string;
};

/**
 * Linha do tempo institucional da Direção: PROJEÇÃO dos ledgers canônicos
 * (decisões, atos, retificações). Nenhum ledger novo é criado aqui.
 */
export function projectLeadershipInstitutionalTimeline(input: {
  decisions: readonly InstitutionalDecisionRecord[];
  projection?: WorkspaceProjection;
}): readonly LeadershipTimelineEntry[] {
  const entries: LeadershipTimelineEntry[] = input.decisions.map((decision) => ({
    entryKey: `decisao::${decision.decisionRecordId}`,
    effectiveDate: decision.effectiveDate,
    recordedAt: decision.recordedAt,
    labelSnapshot: decision.supersedesDecisionRecordId
      ? "Retificação de decisão institucional"
      : "Decisão institucional registrada",
    detailSnapshot:
      decision.act?.labelSnapshot ?? decision.chosenAlternativeDefinitionId,
    sourceTypeDefinitionId: "decisao-institucional-13i",
    entityId: decision.decisionRecordId,
    ...(decision.supersedesDecisionRecordId
      ? { supersedesEntityId: decision.supersedesDecisionRecordId }
      : {}),
  }));

  for (const item of input.projection?.authorizedItems ?? []) {
    if (!item.concludedAt) continue;
    entries.push({
      entryKey: `conclusao::${item.source.entityId}`,
      effectiveDate: item.concludedAt,
      recordedAt: item.recordedAt,
      labelSnapshot: "Processo concluído",
      detailSnapshot: item.titleSnapshot,
      sourceTypeDefinitionId: item.source.sourceTypeDefinitionId,
      entityId: item.source.entityId,
    });
  }

  return entries.sort((left, right) =>
    left.effectiveDate === right.effectiveDate
      ? left.entryKey.localeCompare(right.entryKey)
      : left.effectiveDate.localeCompare(right.effectiveDate),
  );
}

export function leadershipQueueItems(
  projection: WorkspaceProjection,
  queueDefinitionId: string,
): readonly OperationalQueueItem[] {
  return (
    projection.queues.find(
      (queue) => queue.definition.queueDefinitionId === queueDefinitionId,
    )?.items ?? []
  );
}
