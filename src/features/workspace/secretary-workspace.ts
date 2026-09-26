/**
 * Etapa 13G — Perspectiva operacional DEMONSTRATIVA da Secretaria Escolar.
 *
 * Esta perspectiva é CONFIGURAÇÃO: capacidades, finalidades, filas, janelas
 * temporais, processos, seções da ficha e política de acesso são dados. O
 * framework (`workspace-engine.ts`) não conhece "Secretaria" — e a 13H, 13I e
 * 13J nascerão de outra configuração sobre exatamente os mesmos fatos.
 *
 * Nada aqui é norma homologada da Rede. Os processos abaixo são fatos
 * demonstrativos publicados pelos domínios de 13B, 13C, 13D e 13F.
 */
import { formatAcademicDate } from "@/lib/academic-date";
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
  type WorkspaceProcessRegistry,
  type WorkspaceProcessSourceInput,
} from "./workspace-engine";
import type { SearchableSubjectDescriptor } from "./workspace-search";
import {
  WORKSPACE_ADMISSIBILITY,
  type OperationalQueueItem,
  type ProfileSectionProvider,
  type ProfileSectionResult,
  type WorkspaceAccessContext,
  type WorkspaceOperationalFact,
  type WorkspaceQueueDefinition,
  type WorkspaceTemporalWindowDefinition,
} from "./workspace-types";
import { WORKSPACE_PREDICATE_EXECUTOR_IDS } from "./workspace-engine";

export const SECRETARY_PERSPECTIVE_ID = "perspectiva-secretaria-escolar-demo";

/** Capacidades demonstrativas. Autoridade vem daqui, nunca do nome do perfil. */
export const DEMO_WORKSPACE_CAPACITIES = {
  consultStudentLife: "cap-consultar-vida-escolar",
  operateEnrollment: "cap-operar-inscricao-letiva",
  operateAllocation: "cap-operar-enturmacao",
  operateMobility: "cap-operar-mobilidade",
  verifyDocument: "cap-conferir-documento",
  readPedagogicalNote: "cap-ler-anotacao-pedagogica",
  readTechnicalIdentifier: "cap-consultar-identificador-tecnico",
} as const;

export const DEMO_WORKSPACE_PURPOSES = {
  schoolSecretaryOperation: "finalidade-operacao-de-secretaria-escolar",
  pedagogicalFollowUp: "finalidade-acompanhamento-pedagogico",
} as const;

export const DEMO_WORKSPACE_OPERATIONS = {
  readOperationalMetadata: "operacao-consultar-metadados-operacionais",
  concludeEnrollment: "operacao-efetivar-inscricao",
  movementClass: "operacao-movimentar-turma",
  welcomeTransfer: "operacao-acolher-transferencia",
  verifyDocument: "operacao-atestar-conferencia-documental",
  grantDeadline: "operacao-conceder-prazo",
} as const;

export const DEMO_AWAITING_PARTIES = {
  schoolSecretary: "aguardando-secretaria-escolar",
  family: "aguardando-familia-ou-responsavel",
  otherInstitution: "aguardando-outra-instituicao",
} as const;

export const DEMO_WORKSPACE_SCOPE_KINDS = {
  schoolUnit: "escopo-unidade-escolar",
  network: "escopo-rede-municipal",
} as const;

export const DEMO_WORKSPACE_SENSITIVITY = {
  institutional: "publico-institucional",
  restricted: "restrito-orientacao",
} as const;

export const DEMO_WORKSPACE_PROCESS_TYPES = {
  cycleEnrollment: "processo-inscricao-letiva-demo",
  classAllocation: "processo-enturmacao-demo",
  institutionalTransfer: "processo-mobilidade-demo",
  documentIntake: "processo-juntada-documental-demo",
} as const;

export const DEMO_WORKSPACE_DOMAINS = {
  cycleEnrollment: "dominio-13b-inscricao-letiva",
  classAllocation: "dominio-13c-enturmacao",
  transfer: "dominio-13d-mobilidade",
  dossier: "dominio-13f-dossie",
} as const;

export const DEMO_LINK_TARGETS = {
  studentProfile: "destino-ficha-integrada-do-aluno",
  studentRecord: "destino-cadastro-do-aluno",
} as const;

// ------------------------------------------------- Janelas e filas (configuração)

export const demonstrationTemporalWindows: readonly WorkspaceTemporalWindowDefinition[] =
  [
    {
      windowDefinitionId: "janela-prazo-proximo-demo",
      labelSnapshot: "Janela de atenção a prazos (demonstrativa)",
      days: 10,
    },
    {
      windowDefinitionId: "janela-concluido-recentemente-demo",
      labelSnapshot: "Janela de conclusões recentes (demonstrativa)",
      days: 15,
    },
  ];

export const demonstrationSecretaryQueues: readonly WorkspaceQueueDefinition[] = [
  {
    queueDefinitionId: "fila-aguardando-secretaria-demo",
    labelSnapshot: "Aguardando ação da Secretaria",
    descriptionSnapshot:
      "Processos cujos domínios declararam a Secretaria como parte aguardada.",
    order: 1,
    predicates: [
      { predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.notConcluded },
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.awaitingParty,
        parameters: {
          awaitingPartyDefinitionIds: [DEMO_AWAITING_PARTIES.schoolSecretary],
        },
      },
    ],
  },
  {
    queueDefinitionId: "fila-aguardando-terceiro-demo",
    labelSnapshot: "Aguardando família ou outra instituição",
    order: 2,
    predicates: [
      { predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.notConcluded },
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.awaitingParty,
        parameters: {
          awaitingPartyDefinitionIds: [
            DEMO_AWAITING_PARTIES.family,
            DEMO_AWAITING_PARTIES.otherInstitution,
          ],
        },
      },
    ],
  },
  {
    queueDefinitionId: "fila-prazo-proximo-demo",
    labelSnapshot: "Prazo próximo do vencimento",
    order: 3,
    predicates: [
      { predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.notConcluded },
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.deadlineWithinWindow,
        parameters: { windowDefinitionId: "janela-prazo-proximo-demo" },
      },
    ],
  },
  {
    queueDefinitionId: "fila-concluido-recentemente-demo",
    labelSnapshot: "Concluído recentemente",
    order: 4,
    predicates: [
      {
        predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.concludedWithinWindow,
        parameters: { windowDefinitionId: "janela-concluido-recentemente-demo" },
      },
    ],
  },
];

// -------------------------------------------------- Política de acesso (13F)

export const demonstrationWorkspaceAccessPolicy: DossierAccessPolicy = {
  policyId: "pol-acesso-workspace-demo",
  policyVersion: 1,
  validFrom: "2027-01-01",
  validUntil: null,
  homologated: true,
  rules: [
    {
      ruleId: "regra-operacional-institucional",
      priority: 10,
      match: {
        capacityDefinitionIds: [DEMO_WORKSPACE_CAPACITIES.consultStudentLife],
        sensitivityLevelDefinitionIds: [DEMO_WORKSPACE_SENSITIVITY.institutional],
        processingPurposeDefinitionIds: [
          DEMO_WORKSPACE_PURPOSES.schoolSecretaryOperation,
          DEMO_WORKSPACE_PURPOSES.pedagogicalFollowUp,
        ],
        requiresScopeIntersection: true,
      },
      effect: {
        accessEffectDefinitionId: "efeito-conceder-com-auditoria-demo",
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantWithAudit,
      },
    },
    {
      ruleId: "regra-restrita-orientacao",
      priority: 20,
      match: {
        capacityDefinitionIds: [DEMO_WORKSPACE_CAPACITIES.readPedagogicalNote],
        sensitivityLevelDefinitionIds: [DEMO_WORKSPACE_SENSITIVITY.restricted],
        requiresScopeIntersection: true,
      },
      effect: {
        accessEffectDefinitionId: "efeito-conceder-com-auditoria-demo",
        executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantWithAudit,
      },
    },
  ],
  defaultEffect: {
    accessEffectDefinitionId: "efeito-nao-disponibilizar-demo",
    executorId: DOSSIER_ACCESS_EXECUTOR_IDS.withhold,
  },
};

// ---------------------------------------- Fatos demonstrativos dos domínios

/** Entidade demonstrativa "crua" de um domínio, antes do adaptador. */
export type DemonstrationProcessEntity = {
  entityId: string;
  entityVersion: number;
  stateDefinitionId: string;
  stateLabelSnapshot: string;
  studentId: string;
  unitId: string;
  title: string;
  summary: string;
  effectiveDate: string;
  recordedAt: string;
  concludedAt?: string;
  awaitingPartyDefinitionId?: string;
  dueDate?: string;
  sensitivityLevelDefinitionId?: string;
  requirement?: {
    diagnosticCode: string;
    requirementDefinitionId: string;
    messageSnapshot: string;
    effectDefinitionId: string;
    effectLabelSnapshot: string;
    competentExecutorDefinitionId: string;
    policyId: string;
    policyVersion: number;
  };
};

function studentLabel(studentId: string): string {
  const student = demonstrationStudents.find((item) => item.id === studentId);
  return student ? student.personName : studentId;
}

function institutionalIdentifier(studentId: string): string {
  const student = demonstrationStudents.find((item) => item.id === studentId);
  return student ? student.sigemId : studentId;
}

function makeAdapter(input: {
  processTypeDefinitionId: string;
  sourceTypeDefinitionId: string;
  producedByDomainId: string;
  typeDefinitionId: string;
  operations: (
    entity: DemonstrationProcessEntity,
  ) => WorkspaceOperationalFact["availableOperations"];
}) {
  return (raw: unknown): WorkspaceOperationalFact | null => {
    const entity = raw as DemonstrationProcessEntity;
    if (!entity || typeof entity.entityId !== "string") return null;
    const sensitivity =
      entity.sensitivityLevelDefinitionId ?? DEMO_WORKSPACE_SENSITIVITY.institutional;
    return {
      factKey: `${input.sourceTypeDefinitionId}::${entity.entityId}`,
      processTypeDefinitionId: input.processTypeDefinitionId,
      processStateDefinitionId: entity.stateDefinitionId,
      source: {
        sourceTypeDefinitionId: input.sourceTypeDefinitionId,
        entityId: entity.entityId,
        entityVersion: entity.entityVersion,
        sourceProjectionSchemaVersion: 1,
      },
      producedByDomainId: input.producedByDomainId,
      scopeEntities: [
        {
          entityKindDefinitionId: DEMO_WORKSPACE_SCOPE_KINDS.schoolUnit,
          entityId: entity.unitId,
        },
      ],
      subjectReferences: [
        {
          subjectRoleDefinitionId: "titular",
          reference: {
            entityKindDefinitionId: "aluno",
            entityId: entity.studentId,
            labelSnapshot: studentLabel(entity.studentId),
          },
        },
      ],
      titleSnapshot: entity.title,
      summary: entity.summary,
      effectiveDate: entity.effectiveDate,
      recordedAt: entity.recordedAt,
      ...(entity.concludedAt ? { concludedAt: entity.concludedAt } : {}),
      ...(entity.awaitingPartyDefinitionId
        ? { awaitingPartyDefinitionId: entity.awaitingPartyDefinitionId }
        : {}),
      ...(entity.dueDate
        ? {
            deadline: {
              dueDate: entity.dueDate,
              deadlineOriginTypeDefinitionId: "prazo-da-regra",
              labelSnapshot: "Prazo declarado pelo domínio de origem",
            },
          }
        : {}),
      ...(entity.requirement
        ? {
            requirementDiagnostics: [
              {
                diagnosticCode: entity.requirement.diagnosticCode,
                requirementDefinitionId: entity.requirement.requirementDefinitionId,
                messageSnapshot: entity.requirement.messageSnapshot,
                effectDefinitionId: entity.requirement.effectDefinitionId,
                effectLabelSnapshot: entity.requirement.effectLabelSnapshot,
                sourceReference: {
                  sourceTypeDefinitionId: input.sourceTypeDefinitionId,
                  entityId: entity.entityId,
                  entityVersion: entity.entityVersion,
                },
                policyId: entity.requirement.policyId,
                policyVersion: entity.requirement.policyVersion,
                competentExecutorDefinitionId:
                  entity.requirement.competentExecutorDefinitionId,
                ...(entity.dueDate
                  ? {
                      deadline: {
                        dueDate: entity.dueDate,
                        deadlineOriginTypeDefinitionId: "prazo-da-regra",
                      },
                    }
                  : {}),
              },
            ],
          }
        : {}),
      availableOperations: input.operations(entity),
      sensitivityLevelDefinitionId: sensitivity,
      resourceKindDefinitionId: "processo-operacional",
      typeDefinitionId: input.typeDefinitionId,
      projectableFieldPaths: ["estado", "unidade", "observacao", "aluno"],
      payload: {
        estado: entity.stateLabelSnapshot,
        unidade: entity.unitId,
        observacao: entity.summary,
        aluno: studentLabel(entity.studentId),
      },
      policyId: entity.requirement?.policyId ?? "cfg-demonstrativa",
      policyVersion: entity.requirement?.policyVersion ?? 1,
      deepLink: {
        linkTargetDefinitionId: DEMO_LINK_TARGETS.studentProfile,
        params: { alunoId: entity.studentId },
        labelSnapshot: `Abrir ficha de ${studentLabel(entity.studentId)}`,
      },
    };
  };
}

/** Registro de processos: um novo processo entra aqui, sem tocar no núcleo. */
export function createSecretaryProcessRegistry(): WorkspaceProcessRegistry {
  const registry = createProcessRegistry();

  registerProcessType(registry, {
    processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.cycleEnrollment,
    labelSnapshot: "Inscrição letiva",
    executingDomainId: DEMO_WORKSPACE_DOMAINS.cycleEnrollment,
    projectionAdapter: makeAdapter({
      processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.cycleEnrollment,
      sourceTypeDefinitionId: "fonte-inscricao-letiva-demo",
      producedByDomainId: DEMO_WORKSPACE_DOMAINS.cycleEnrollment,
      typeDefinitionId: "tipo-inscricao-letiva",
      operations: (entity) => [
        {
          operationDefinitionId: DEMO_WORKSPACE_OPERATIONS.concludeEnrollment,
          labelSnapshot: "Efetivar inscrição",
          executingDomainId: DEMO_WORKSPACE_DOMAINS.cycleEnrollment,
          admissibility: entity.requirement
            ? WORKSPACE_ADMISSIBILITY.inadmissible
            : WORKSPACE_ADMISSIBILITY.admissible,
          requiredCapacityDefinitionIds: [
            DEMO_WORKSPACE_CAPACITIES.operateEnrollment,
          ],
          ...(entity.requirement
            ? { impedimentMessages: [entity.requirement.messageSnapshot] }
            : {}),
        },
        {
          operationDefinitionId: DEMO_WORKSPACE_OPERATIONS.grantDeadline,
          labelSnapshot: "Conceder prazo por ato fundamentado",
          executingDomainId: DEMO_WORKSPACE_DOMAINS.cycleEnrollment,
          admissibility: WORKSPACE_ADMISSIBILITY.admissible,
          requiredCapacityDefinitionIds: [
            DEMO_WORKSPACE_CAPACITIES.operateEnrollment,
          ],
        },
      ],
    }),
  });

  registerProcessType(registry, {
    processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.classAllocation,
    labelSnapshot: "Enturmação e movimentação",
    executingDomainId: DEMO_WORKSPACE_DOMAINS.classAllocation,
    projectionAdapter: makeAdapter({
      processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.classAllocation,
      sourceTypeDefinitionId: "fonte-enturmacao-demo",
      producedByDomainId: DEMO_WORKSPACE_DOMAINS.classAllocation,
      typeDefinitionId: "tipo-enturmacao",
      operations: () => [
        {
          operationDefinitionId: DEMO_WORKSPACE_OPERATIONS.movementClass,
          labelSnapshot: "Movimentar de turma",
          executingDomainId: DEMO_WORKSPACE_DOMAINS.classAllocation,
          admissibility: WORKSPACE_ADMISSIBILITY.admissible,
          requiredCapacityDefinitionIds: [
            DEMO_WORKSPACE_CAPACITIES.operateAllocation,
          ],
        },
      ],
    }),
  });

  registerProcessType(registry, {
    processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.institutionalTransfer,
    labelSnapshot: "Mobilidade institucional",
    executingDomainId: DEMO_WORKSPACE_DOMAINS.transfer,
    projectionAdapter: makeAdapter({
      processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.institutionalTransfer,
      sourceTypeDefinitionId: "fonte-mobilidade-demo",
      producedByDomainId: DEMO_WORKSPACE_DOMAINS.transfer,
      typeDefinitionId: "tipo-mobilidade",
      operations: () => [
        {
          operationDefinitionId: DEMO_WORKSPACE_OPERATIONS.welcomeTransfer,
          labelSnapshot: "Acolher transferência",
          executingDomainId: DEMO_WORKSPACE_DOMAINS.transfer,
          admissibility: WORKSPACE_ADMISSIBILITY.admissible,
          requiredCapacityDefinitionIds: [DEMO_WORKSPACE_CAPACITIES.operateMobility],
        },
      ],
    }),
  });

  registerProcessType(registry, {
    processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.documentIntake,
    labelSnapshot: "Juntada e conferência documental",
    executingDomainId: DEMO_WORKSPACE_DOMAINS.dossier,
    projectionAdapter: makeAdapter({
      processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.documentIntake,
      sourceTypeDefinitionId: "fonte-juntada-documental-demo",
      producedByDomainId: DEMO_WORKSPACE_DOMAINS.dossier,
      typeDefinitionId: "tipo-juntada-documental",
      operations: () => [
        {
          operationDefinitionId: DEMO_WORKSPACE_OPERATIONS.verifyDocument,
          labelSnapshot: "Atestar conferência do documento",
          executingDomainId: DEMO_WORKSPACE_DOMAINS.dossier,
          admissibility: WORKSPACE_ADMISSIBILITY.admissible,
          requiredCapacityDefinitionIds: [DEMO_WORKSPACE_CAPACITIES.verifyDocument],
        },
      ],
    }),
  });

  return registry;
}

export const demonstrationProcessSources: readonly WorkspaceProcessSourceInput[] = [
  {
    processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.cycleEnrollment,
    entities: [
      {
        entityId: "insc-demo-001",
        entityVersion: 2,
        stateDefinitionId: "inscricao-em-andamento",
        stateLabelSnapshot: "Inscrição em andamento",
        studentId: "alu-001",
        unitId: "demo-001",
        title: "Inscrição letiva com exigência documental pendente",
        summary:
          "Inscrição constituída aguardando apresentação de documento exigido pela política de requisitos.",
        effectiveDate: "2027-02-03",
        recordedAt: "2027-02-03T12:00:00.000Z",
        awaitingPartyDefinitionId: DEMO_AWAITING_PARTIES.family,
        dueDate: "2027-03-05",
        requirement: {
          diagnosticCode: "REQ-DOC-PENDENTE",
          requirementDefinitionId: "req-certidao-de-nascimento-demo",
          messageSnapshot:
            "Certidão de nascimento ainda não apresentada nem dispensada.",
          effectDefinitionId: "efeito-permite-com-prazo",
          effectLabelSnapshot: "Permite prosseguir com prazo declarado",
          competentExecutorDefinitionId: "executor-secretaria-escolar",
          policyId: "pol-requisitos-inscricao-demo",
          policyVersion: 3,
        },
      } satisfies DemonstrationProcessEntity,
      {
        entityId: "insc-demo-002",
        entityVersion: 1,
        stateDefinitionId: "inscricao-constituida",
        stateLabelSnapshot: "Inscrição constituída",
        studentId: "alu-002",
        unitId: "demo-002",
        title: "Rematrícula concluída no ciclo demonstrativo",
        summary: "Rito de continuidade concluído sem pendências registradas.",
        effectiveDate: "2027-02-01",
        recordedAt: "2027-02-01T09:00:00.000Z",
        concludedAt: "2027-02-10",
      } satisfies DemonstrationProcessEntity,
    ],
  },
  {
    processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.classAllocation,
    entities: [
      {
        entityId: "alo-demo-001",
        entityVersion: 1,
        stateDefinitionId: "movimentacao-em-aberto",
        stateLabelSnapshot: "Movimentação em aberto",
        studentId: "alu-001",
        unitId: "demo-001",
        title: "Movimentação de turma aguardando conclusão pela Secretaria",
        summary:
          "Plano de movimentação com origem a encerrar e destino a constituir; nada é aplicado parcialmente.",
        effectiveDate: "2027-02-18",
        recordedAt: "2027-02-18T14:30:00.000Z",
        awaitingPartyDefinitionId: DEMO_AWAITING_PARTIES.schoolSecretary,
      } satisfies DemonstrationProcessEntity,
    ],
  },
  {
    processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.institutionalTransfer,
    entities: [
      {
        entityId: "mob-demo-001",
        entityVersion: 3,
        stateDefinitionId: "estagio-em-analise-demo",
        stateLabelSnapshot: "Em análise",
        studentId: "alu-002",
        unitId: "demo-002",
        title: "Transferência em tramitação com instituição externa",
        summary:
          "Processo de mobilidade aguardando manifestação do polo de destino declarado.",
        effectiveDate: "2027-02-20",
        recordedAt: "2027-02-20T16:00:00.000Z",
        awaitingPartyDefinitionId: DEMO_AWAITING_PARTIES.otherInstitution,
        dueDate: "2027-02-28",
      } satisfies DemonstrationProcessEntity,
    ],
  },
  {
    processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.documentIntake,
    entities: [
      {
        entityId: "doc-demo-001",
        entityVersion: 1,
        stateDefinitionId: "conferencia-pendente",
        stateLabelSnapshot: "Conferência pendente",
        studentId: "alu-001",
        unitId: "demo-001",
        title: "Documento apresentado aguardando conferência",
        summary:
          "Representação digital juntada ao dossiê; conferência administrativa ainda não atestada.",
        effectiveDate: "2027-02-22",
        recordedAt: "2027-02-22T11:15:00.000Z",
        awaitingPartyDefinitionId: DEMO_AWAITING_PARTIES.schoolSecretary,
      } satisfies DemonstrationProcessEntity,
      {
        entityId: "doc-demo-002",
        entityVersion: 1,
        stateDefinitionId: "anotacao-registrada",
        stateLabelSnapshot: "Anotação registrada",
        studentId: "alu-001",
        unitId: "demo-001",
        title: "Anotação pedagógica restrita",
        summary:
          "Registro de sensibilidade restrita: fora da finalidade da Secretaria, não entra em fila, contagem ou busca.",
        effectiveDate: "2027-02-19",
        recordedAt: "2027-02-19T10:00:00.000Z",
        awaitingPartyDefinitionId: DEMO_AWAITING_PARTIES.schoolSecretary,
        sensitivityLevelDefinitionId: DEMO_WORKSPACE_SENSITIVITY.restricted,
      } satisfies DemonstrationProcessEntity,
    ],
  },
];

// -------------------------------------------- Sujeitos pesquisáveis (13A/13F)

export const demonstrationSearchableSubjects: readonly SearchableSubjectDescriptor[] =
  demonstrationStudents
    .filter((student) => student.currentUnitId !== null)
    .map((student) => ({
      subjectEntityId: student.id,
      subjectTypeDefinitionId: "aluno",
      scopeEntities: [
        {
          entityKindDefinitionId: DEMO_WORKSPACE_SCOPE_KINDS.schoolUnit,
          entityId: student.currentUnitId ?? "",
        },
      ],
      attributes: [
        {
          attributeDefinitionId: "nome-da-pessoa",
          labelSnapshot: "Nome",
          value: student.personName,
          requiredCapacityDefinitionIds: [
            DEMO_WORKSPACE_CAPACITIES.consultStudentLife,
          ],
        },
        {
          attributeDefinitionId: "identificador-institucional",
          labelSnapshot: "Identificador institucional",
          value: student.sigemId,
          requiredCapacityDefinitionIds: [
            DEMO_WORKSPACE_CAPACITIES.consultStudentLife,
          ],
          institutionalIdentifier: true,
        },
        {
          attributeDefinitionId: "identificador-tecnico",
          labelSnapshot: "Identificador técnico interno",
          value: student.id,
          requiredCapacityDefinitionIds: [
            DEMO_WORKSPACE_CAPACITIES.readTechnicalIdentifier,
          ],
          technicalIdentifier: true,
        },
      ],
      deepLink: {
        linkTargetDefinitionId: DEMO_LINK_TARGETS.studentProfile,
        params: { alunoId: student.id },
        labelSnapshot: `Abrir ficha integrada de ${student.personName}`,
      },
    }));

// ------------------------------------- Seções da ficha (registro por domínio)

function sectionFromProcess(input: {
  sectionDefinitionId: string;
  labelSnapshot: string;
  order: number;
  processTypeDefinitionId: string;
  emptySnapshot: string;
}): ProfileSectionProvider {
  return ({ authorizedItems }): ProfileSectionResult => {
    const items = authorizedItems.filter(
      (item) => item.processTypeDefinitionId === input.processTypeDefinitionId,
    );
    const entries = items.map((item) => ({
      term: item.titleSnapshot,
      detailSnapshot: `${formatAcademicDate(item.effectiveDate)} · ${String(
        item.authorizedPayload["estado"] ?? item.processStateDefinitionId,
      )}`,
      sourceReference: item.source,
    }));
    return {
      sectionDefinitionId: input.sectionDefinitionId,
      labelSnapshot: input.labelSnapshot,
      order: input.order,
      entries:
        entries.length > 0
          ? entries
          : [{ term: "Sem fato autorizado", detailSnapshot: input.emptySnapshot }],
      actions: items.flatMap((item) => item.actions),
      diagnostics: [],
    };
  };
}

export function createSecretaryProfileSectionRegistry() {
  const registry = createProfileSectionRegistry();

  registerProfileSection(registry, {
    sectionDefinitionId: "secao-identidade-e-vinculo",
    provider: ({ subjectEntityId }) => ({
      sectionDefinitionId: "secao-identidade-e-vinculo",
      labelSnapshot: "Identidade e vínculo institucional",
      order: 1,
      entries: [
        {
          term: "Identificador institucional",
          detailSnapshot: institutionalIdentifier(subjectEntityId),
        },
        { term: "Pessoa", detailSnapshot: studentLabel(subjectEntityId) },
      ],
      actions: [],
      diagnostics: [],
    }),
  });

  registerProfileSection(registry, {
    sectionDefinitionId: "secao-inscricao-letiva",
    provider: sectionFromProcess({
      sectionDefinitionId: "secao-inscricao-letiva",
      labelSnapshot: "Inscrições letivas",
      order: 2,
      processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.cycleEnrollment,
      emptySnapshot: "Nenhuma inscrição autorizada para esta finalidade.",
    }),
  });

  registerProfileSection(registry, {
    sectionDefinitionId: "secao-enturmacao",
    provider: sectionFromProcess({
      sectionDefinitionId: "secao-enturmacao",
      labelSnapshot: "Turma e movimentações",
      order: 3,
      processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.classAllocation,
      emptySnapshot: "Nenhuma enturmação autorizada para esta finalidade.",
    }),
  });

  registerProfileSection(registry, {
    sectionDefinitionId: "secao-mobilidade",
    provider: sectionFromProcess({
      sectionDefinitionId: "secao-mobilidade",
      labelSnapshot: "Mobilidade institucional",
      order: 4,
      processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.institutionalTransfer,
      emptySnapshot: "Nenhum processo de mobilidade autorizado.",
    }),
  });

  registerProfileSection(registry, {
    sectionDefinitionId: "secao-dossie",
    provider: sectionFromProcess({
      sectionDefinitionId: "secao-dossie",
      labelSnapshot: "Documentos e prontuário",
      order: 5,
      processTypeDefinitionId: DEMO_WORKSPACE_PROCESS_TYPES.documentIntake,
      emptySnapshot: "Nenhum documento autorizado para esta finalidade.",
    }),
  });

  return registry;
}

// ------------------------------------------------------------- Composição

export function createSecretaryAccessContext(input?: {
  capacityDefinitionIds?: readonly string[];
  institutionalScopeIds?: readonly string[];
  requestedAt?: string;
  processingPurposeDefinitionId?: string;
}): WorkspaceAccessContext {
  return {
    actorId: "agente-secretaria-demo",
    capacityDefinitionIds:
      input?.capacityDefinitionIds ?? [
        DEMO_WORKSPACE_CAPACITIES.consultStudentLife,
        DEMO_WORKSPACE_CAPACITIES.operateEnrollment,
        DEMO_WORKSPACE_CAPACITIES.operateAllocation,
        DEMO_WORKSPACE_CAPACITIES.operateMobility,
        DEMO_WORKSPACE_CAPACITIES.verifyDocument,
      ],
    institutionalScopes: (input?.institutionalScopeIds ?? ["demo-001"]).map(
      (entityId) => ({
        entityKindDefinitionId: DEMO_WORKSPACE_SCOPE_KINDS.schoolUnit,
        entityId,
      }),
    ),
    processingPurposeDefinitionId:
      input?.processingPurposeDefinitionId ??
      DEMO_WORKSPACE_PURPOSES.schoolSecretaryOperation,
    readOperationDefinitionId: DEMO_WORKSPACE_OPERATIONS.readOperationalMetadata,
    requestedAt: input?.requestedAt ?? "2027-02-25T12:00:00.000Z",
  };
}

/** Projeção operacional completa da Secretaria (demonstrativa). */
export function buildSecretaryWorkspaceProjection(input?: {
  context?: WorkspaceAccessContext;
  sources?: readonly WorkspaceProcessSourceInput[];
  queueDefinitions?: readonly WorkspaceQueueDefinition[];
  temporalWindows?: readonly WorkspaceTemporalWindowDefinition[];
}) {
  const context = input?.context ?? createSecretaryAccessContext();
  const registry = createSecretaryProcessRegistry();
  const projected = projectProcessFacts({
    sources: input?.sources ?? demonstrationProcessSources,
    registry,
  });

  return projectWorkspace({
    workspacePerspectiveDefinitionId: SECRETARY_PERSPECTIVE_ID,
    context,
    accessPolicy: demonstrationWorkspaceAccessPolicy,
    facts: projected.facts,
    queueDefinitions: input?.queueDefinitions ?? demonstrationSecretaryQueues,
    temporalWindows: input?.temporalWindows ?? demonstrationTemporalWindows,
    producedAt: context.requestedAt,
    upstreamDiagnostics: projected.diagnostics,
  });
}

export function buildSecretaryIntegratedProfile(input: {
  subjectEntityId: string;
  context?: WorkspaceAccessContext;
}) {
  const context = input.context ?? createSecretaryAccessContext();
  const projection = buildSecretaryWorkspaceProjection({ context });
  return {
    projection,
    ...projectIntegratedProfile({
      subjectEntityId: input.subjectEntityId,
      context,
      projection,
      registry: createSecretaryProfileSectionRegistry(),
    }),
  };
}

export function queueItemsOf(
  projection: { queues: readonly { definition: WorkspaceQueueDefinition; items: readonly OperationalQueueItem[] }[] },
  queueDefinitionId: string,
): readonly OperationalQueueItem[] {
  return (
    projection.queues.find(
      (queue) => queue.definition.queueDefinitionId === queueDefinitionId,
    )?.items ?? []
  );
}
