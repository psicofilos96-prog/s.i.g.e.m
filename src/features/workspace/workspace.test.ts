/**
 * Etapa 13G — Testes do Workspace Projection Framework e da perspectiva
 * demonstrativa da Secretaria Escolar.
 *
 * Cobrem: não duplicação de verdade, segurança contra inferência, falha fechada,
 * ação disponível x autorizada, extensibilidade de processos e seções, janelas
 * configuráveis, múltiplos escopos, deep links, datas brasileiras, proveniência
 * e reutilização do framework por uma SEGUNDA perspectiva fictícia.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  WORKSPACE_ADMISSIBILITY,
  WORKSPACE_AUTHORIZATION,
  WORKSPACE_PROJECTION_SCHEMA_VERSION,
  type WorkspaceOperationalFact,
  type WorkspaceQueueDefinition,
} from "./workspace-types";
import {
  createProcessRegistry,
  createProfileSectionRegistry,
  createQueuePredicateRegistry,
  describeAction,
  isActionExecutable,
  projectIntegratedProfile,
  projectProcessFacts,
  projectWorkspace,
  registerProcessType,
  registerProfileSection,
  registerQueuePredicateExecutor,
  selectAuthorizedWorkspaceItems,
  WORKSPACE_PREDICATE_EXECUTOR_IDS,
} from "./workspace-engine";
import {
  buildAuthorizedSearchIndex,
  searchAuthorizedSubjects,
} from "./workspace-search";
import {
  buildSecretaryIntegratedProfile,
  buildSecretaryWorkspaceProjection,
  createSecretaryAccessContext,
  createSecretaryProcessRegistry,
  createSecretaryProfileSectionRegistry,
  DEMO_AWAITING_PARTIES,
  DEMO_WORKSPACE_CAPACITIES,
  DEMO_WORKSPACE_OPERATIONS,
  DEMO_WORKSPACE_PROCESS_TYPES,
  DEMO_WORKSPACE_PURPOSES,
  DEMO_WORKSPACE_SCOPE_KINDS,
  demonstrationProcessSources,
  demonstrationSearchableSubjects,
  demonstrationSecretaryQueues,
  demonstrationTemporalWindows,
  demonstrationWorkspaceAccessPolicy,
  queueItemsOf,
  SECRETARY_PERSPECTIVE_ID,
} from "./secretary-workspace";

const AWAITING_SECRETARY_QUEUE = "fila-aguardando-secretaria-demo";
const DEADLINE_QUEUE = "fila-prazo-proximo-demo";
const RECENT_QUEUE = "fila-concluido-recentemente-demo";

describe("13G — projeção operacional da Secretaria", () => {
  it("projeta filas configuradas com proveniência técnica", () => {
    const projection = buildSecretaryWorkspaceProjection();
    expect(projection.workspaceProjectionSchemaVersion).toBe(
      WORKSPACE_PROJECTION_SCHEMA_VERSION,
    );
    expect(projection.workspacePerspectiveDefinitionId).toBe(SECRETARY_PERSPECTIVE_ID);
    expect(projection.producedAt).toBe("2027-02-25T12:00:00.000Z");
    expect(projection.accessPolicyId).toBe(demonstrationWorkspaceAccessPolicy.policyId);
    expect(projection.accessPolicyVersion).toBe(1);
    expect(projection.queues.map((queue) => queue.definition.queueDefinitionId)).toEqual(
      demonstrationSecretaryQueues.map((queue) => queue.queueDefinitionId),
    );
  });

  it("registra as fontes consultadas e suas versões de esquema", () => {
    const projection = buildSecretaryWorkspaceProjection();
    expect(projection.consultedSources.length).toBeGreaterThan(0);
    for (const source of projection.consultedSources) {
      expect(source.sourceProjectionSchemaVersions).toContain(1);
      expect(source.producedByDomainId).toMatch(/^dominio-/);
    }
  });

  it("classifica 'aguardando Secretaria' apenas por parte declarada pelo domínio", () => {
    const projection = buildSecretaryWorkspaceProjection();
    const items = queueItemsOf(projection, AWAITING_SECRETARY_QUEUE);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.awaitingPartyDefinitionId).toBe(DEMO_AWAITING_PARTIES.schoolSecretary);
      expect(item.concludedAt).toBeUndefined();
    }
  });

  it("não inventa contagem: itemCount é o tamanho da própria fila projetada", () => {
    const projection = buildSecretaryWorkspaceProjection();
    for (const queue of projection.queues) {
      expect(queue.itemCount).toBe(queue.items.length);
    }
  });

  it("agrega a matriz de pendências preservando política, versão e executor competente", () => {
    const projection = buildSecretaryWorkspaceProjection();
    expect(projection.requirementMatrix.length).toBeGreaterThan(0);
    const diagnostic = projection.requirementMatrix[0]!;
    expect(diagnostic.policyId).toBe("pol-requisitos-inscricao-demo");
    expect(diagnostic.policyVersion).toBe(3);
    expect(diagnostic.competentExecutorDefinitionId).toBe("executor-secretaria-escolar");
    expect(diagnostic.effectDefinitionId).toBe("efeito-permite-com-prazo");
    expect(diagnostic.sourceReference.entityId).toBe("insc-demo-001");
  });

  it("entrega deep link para o objeto real que originou o item", () => {
    const projection = buildSecretaryWorkspaceProjection();
    const items = queueItemsOf(projection, AWAITING_SECRETARY_QUEUE);
    for (const item of items) {
      expect(item.deepLink?.params["alunoId"]).toMatch(/^alu-/);
    }
  });
});

describe("13G — item de fila é projeção, não entidade", () => {
  it("usa chave determinística e reprodutível", () => {
    const first = buildSecretaryWorkspaceProjection();
    const second = buildSecretaryWorkspaceProjection();
    expect(queueItemsOf(first, AWAITING_SECRETARY_QUEUE).map((i) => i.queueItemKey)).toEqual(
      queueItemsOf(second, AWAITING_SECRETARY_QUEUE).map((i) => i.queueItemKey),
    );
  });

  it("não possui estado próprio concorrente: estado vem do processo de origem", () => {
    const projection = buildSecretaryWorkspaceProjection();
    for (const item of projection.authorizedItems) {
      expect(item.processStateDefinitionId.length).toBeGreaterThan(0);
      expect(Object.keys(item)).not.toContain("queueItemState");
      expect(Object.keys(item)).not.toContain("workspaceStatus");
    }
  });

  it("o mesmo fato pode aparecer em mais de uma fila sem duplicar a verdade", () => {
    const projection = buildSecretaryWorkspaceProjection();
    const sources = projection.queues.flatMap((queue) =>
      queue.items.map((item) => item.source.entityId),
    );
    const unique = new Set(sources);
    expect(unique.size).toBeLessThanOrEqual(sources.length);
    // A verdade permanece uma: um item por fonte no conjunto autorizado.
    const authorized = projection.authorizedItems.map((item) => item.source.entityId);
    expect(new Set(authorized).size).toBe(authorized.length);
  });
});

describe("13G — ação disponível x ação autorizada", () => {
  const baseDeclaration = {
    operationDefinitionId: DEMO_WORKSPACE_OPERATIONS.verifyDocument,
    labelSnapshot: "Atestar conferência",
    executingDomainId: "dominio-13f-dossie",
    admissibility: WORKSPACE_ADMISSIBILITY.admissible,
    requiredCapacityDefinitionIds: [DEMO_WORKSPACE_CAPACITIES.verifyDocument],
  };

  it("explica operação tecnicamente possível, porém não autorizada", () => {
    const action = describeAction({
      factKey: "fato-x",
      declaration: baseDeclaration,
      context: createSecretaryAccessContext({
        capacityDefinitionIds: [DEMO_WORKSPACE_CAPACITIES.consultStudentLife],
      }),
    });
    expect(action.processAdmissibility).toBe(WORKSPACE_ADMISSIBILITY.admissible);
    expect(action.actorAuthorization).toBe(WORKSPACE_AUTHORIZATION.notAuthorized);
    expect(action.missingCapacityDefinitionIds).toEqual([
      DEMO_WORKSPACE_CAPACITIES.verifyDocument,
    ]);
    expect(action.explanation).toContain("não possui a capacidade exigida");
    expect(isActionExecutable(action)).toBe(false);
  });

  it("explica processo inadmissível mesmo com agente autorizado", () => {
    const action = describeAction({
      factKey: "fato-y",
      declaration: {
        ...baseDeclaration,
        admissibility: WORKSPACE_ADMISSIBILITY.inadmissible,
        impedimentMessages: ["Documento exigido ainda não apresentado."],
      },
      context: createSecretaryAccessContext(),
    });
    expect(action.actorAuthorization).toBe(WORKSPACE_AUTHORIZATION.authorized);
    expect(action.explanation).toContain("não admite a operação agora");
    expect(action.impedimentMessages).toHaveLength(1);
    expect(isActionExecutable(action)).toBe(false);
  });

  it("falha FECHADA quando a autorização é indeterminável", () => {
    const action = describeAction({
      factKey: "fato-z",
      declaration: { ...baseDeclaration, requiredCapacityDefinitionIds: [] },
      context: createSecretaryAccessContext(),
    });
    expect(action.actorAuthorization).toBe(WORKSPACE_AUTHORIZATION.inconclusive);
    expect(action.explanation).toContain("Não é possível determinar a autorização");
    expect(isActionExecutable(action)).toBe(false);
  });

  it("executa somente quando processo admite e agente está autorizado", () => {
    const action = describeAction({
      factKey: "fato-w",
      declaration: baseDeclaration,
      context: createSecretaryAccessContext(),
    });
    expect(isActionExecutable(action)).toBe(true);
  });

  it("a inscrição com exigência pendente não oferece efetivação executável", () => {
    const projection = buildSecretaryWorkspaceProjection();
    const item = projection.authorizedItems.find(
      (candidate) => candidate.source.entityId === "insc-demo-001",
    )!;
    const conclude = item.actions.find(
      (action) =>
        action.operationDefinitionId === DEMO_WORKSPACE_OPERATIONS.concludeEnrollment,
    )!;
    expect(conclude.processAdmissibility).toBe(WORKSPACE_ADMISSIBILITY.inadmissible);
    expect(conclude.actorAuthorization).toBe(WORKSPACE_AUTHORIZATION.authorized);
    expect(isActionExecutable(conclude)).toBe(false);
  });
});

describe("13G — autorização antes da projeção", () => {
  it("fato de sensibilidade restrita não entra em fila, contagem nem matriz", () => {
    const projection = buildSecretaryWorkspaceProjection();
    const allIds = [
      ...projection.authorizedItems.map((item) => item.source.entityId),
      ...projection.queues.flatMap((queue) =>
        queue.items.map((item) => item.source.entityId),
      ),
    ];
    expect(allIds).not.toContain("doc-demo-002");
    expect(JSON.stringify(projection)).not.toContain("Anotação pedagógica restrita");
  });

  it("não revela a quantidade de fatos retidos", () => {
    const projection = buildSecretaryWorkspaceProjection();
    expect(Object.keys(projection)).not.toContain("withheldCount");
    expect(JSON.stringify(projection)).not.toContain("withheld");
  });

  it("política não homologada não disponibiliza nada", () => {
    const projected = projectProcessFacts({
      sources: demonstrationProcessSources,
      registry: createSecretaryProcessRegistry(),
    });
    const result = selectAuthorizedWorkspaceItems({
      facts: projected.facts,
      context: createSecretaryAccessContext(),
      accessPolicy: { ...demonstrationWorkspaceAccessPolicy, homologated: false },
    });
    expect(result.items).toHaveLength(0);
  });

  it("finalidade divergente não produz projeção operacional", () => {
    const projection = buildSecretaryWorkspaceProjection({
      context: createSecretaryAccessContext({
        processingPurposeDefinitionId: "finalidade-nao-declarada-na-politica",
      }),
    });
    expect(projection.authorizedItems).toHaveLength(0);
  });

  it("escopo institucional sem interseção não revela processos", () => {
    const projection = buildSecretaryWorkspaceProjection({
      context: createSecretaryAccessContext({ institutionalScopeIds: ["demo-999"] }),
    });
    expect(projection.authorizedItems).toHaveLength(0);
  });

  it("suporta múltiplos escopos institucionais simultâneos", () => {
    const single = buildSecretaryWorkspaceProjection({
      context: createSecretaryAccessContext({ institutionalScopeIds: ["demo-001"] }),
    });
    const multiple = buildSecretaryWorkspaceProjection({
      context: createSecretaryAccessContext({
        institutionalScopeIds: ["demo-001", "demo-002"],
      }),
    });
    expect(multiple.authorizedItems.length).toBeGreaterThan(single.authorizedItems.length);
    expect(multiple.institutionalScopes).toHaveLength(2);
  });
});

describe("13G — Busca Universal segura contra inferência", () => {
  const context = createSecretaryAccessContext({
    institutionalScopeIds: ["demo-001", "demo-002"],
  });

  it("encontra por nome e por identificador institucional", () => {
    const byName = searchAuthorizedSubjects({
      query: "Fictícia",
      subjects: demonstrationSearchableSubjects,
      context,
    });
    expect(byName.length).toBeGreaterThan(0);
    const byIdentifier = searchAuthorizedSubjects({
      query: "SIGEM-AL",
      subjects: demonstrationSearchableSubjects,
      context,
    });
    expect(byIdentifier.length).toBeGreaterThan(0);
  });

  it("não indexa o identificador técnico sem capacidade específica", () => {
    const index = buildAuthorizedSearchIndex({
      subjects: demonstrationSearchableSubjects,
      context,
    });
    for (const entry of index) {
      expect(
        entry.authorizedAttributes.map((attribute) => attribute.attributeDefinitionId),
      ).not.toContain("identificador-tecnico");
    }
    expect(
      searchAuthorizedSubjects({
        query: "alu-001",
        subjects: demonstrationSearchableSubjects,
        context,
      }),
    ).toHaveLength(0);
  });

  it("indexa o identificador técnico quando há capacidade declarada", () => {
    const supportContext = createSecretaryAccessContext({
      institutionalScopeIds: ["demo-001"],
      capacityDefinitionIds: [
        DEMO_WORKSPACE_CAPACITIES.consultStudentLife,
        DEMO_WORKSPACE_CAPACITIES.readTechnicalIdentifier,
      ],
    });
    const hits = searchAuthorizedSubjects({
      query: "alu-001",
      subjects: demonstrationSearchableSubjects,
      context: supportContext,
    });
    expect(hits).toHaveLength(1);
  });

  it("sujeito fora do escopo não é revelado por nenhuma via", () => {
    const outOfScope = createSecretaryAccessContext({
      institutionalScopeIds: ["demo-002"],
    });
    const hits = searchAuthorizedSubjects({
      query: "Fictícia",
      subjects: demonstrationSearchableSubjects,
      context: outOfScope,
    });
    for (const hit of hits) {
      const subject = demonstrationSearchableSubjects.find(
        (candidate) => candidate.subjectEntityId === hit.subjectEntityId,
      )!;
      expect(subject.scopeEntities.map((scope) => scope.entityId)).toContain("demo-002");
    }
  });

  it("falha fechada: atributo sem capacidade declarada não é pesquisável", () => {
    const hits = searchAuthorizedSubjects({
      query: "sem-capacidade",
      subjects: [
        {
          subjectEntityId: "sujeito-demo",
          subjectTypeDefinitionId: "aluno",
          scopeEntities: [
            {
              entityKindDefinitionId: DEMO_WORKSPACE_SCOPE_KINDS.schoolUnit,
              entityId: "demo-001",
            },
          ],
          attributes: [
            {
              attributeDefinitionId: "atributo-sem-capacidade",
              labelSnapshot: "Atributo",
              value: "sem-capacidade",
              requiredCapacityDefinitionIds: [],
            },
          ],
          deepLink: {
            linkTargetDefinitionId: "destino-x",
            params: {},
            labelSnapshot: "Abrir",
          },
        },
      ],
      context,
    });
    expect(hits).toHaveLength(0);
  });
});

describe("13G — extensibilidade sem alterar o núcleo", () => {
  it("registra um novo tipo de processo sem tocar no framework", () => {
    const registry = createSecretaryProcessRegistry();
    registerProcessType(registry, {
      processTypeDefinitionId: "processo-inedito-demo",
      labelSnapshot: "Processo inédito",
      executingDomainId: "dominio-futuro",
      projectionAdapter: (raw) => {
        const entity = raw as { id: string };
        return {
          factKey: `fonte-inedita::${entity.id}`,
          processTypeDefinitionId: "processo-inedito-demo",
          processStateDefinitionId: "estado-inedito",
          source: { sourceTypeDefinitionId: "fonte-inedita", entityId: entity.id },
          producedByDomainId: "dominio-futuro",
          scopeEntities: [
            {
              entityKindDefinitionId: DEMO_WORKSPACE_SCOPE_KINDS.schoolUnit,
              entityId: "demo-001",
            },
          ],
          subjectReferences: [
            {
              subjectRoleDefinitionId: "titular",
              reference: { entityKindDefinitionId: "aluno", entityId: "alu-001" },
            },
          ],
          titleSnapshot: "Fato inédito",
          effectiveDate: "2027-02-24",
          recordedAt: "2027-02-24T10:00:00.000Z",
          awaitingPartyDefinitionId: DEMO_AWAITING_PARTIES.schoolSecretary,
          sensitivityLevelDefinitionId: "publico-institucional",
          resourceKindDefinitionId: "processo-operacional",
          typeDefinitionId: "tipo-inedito",
          projectableFieldPaths: ["estado"],
          payload: { estado: "Estado inédito" },
        } satisfies WorkspaceOperationalFact;
      },
    });

    const projected = projectProcessFacts({
      sources: [
        ...demonstrationProcessSources,
        { processTypeDefinitionId: "processo-inedito-demo", entities: [{ id: "x1" }] },
      ],
      registry,
    });
    const projection = projectWorkspace({
      workspacePerspectiveDefinitionId: SECRETARY_PERSPECTIVE_ID,
      context: createSecretaryAccessContext(),
      accessPolicy: demonstrationWorkspaceAccessPolicy,
      facts: projected.facts,
      queueDefinitions: demonstrationSecretaryQueues,
      temporalWindows: demonstrationTemporalWindows,
      producedAt: "2027-02-25T12:00:00.000Z",
    });
    expect(
      queueItemsOf(projection, AWAITING_SECRETARY_QUEUE).map((item) => item.source.entityId),
    ).toContain("x1");
  });

  it("fonte sem adaptador registrado é diagnóstico, nunca suposição", () => {
    const projected = projectProcessFacts({
      sources: [{ processTypeDefinitionId: "processo-sem-adaptador", entities: [{}] }],
      registry: createProcessRegistry(),
    });
    expect(projected.facts).toHaveLength(0);
    expect(projected.diagnostics[0]).toContain("sem adaptador registrado");
  });

  it("registra um novo predicado de fila por executor", () => {
    const predicates = registerQueuePredicateExecutor(
      createQueuePredicateRegistry(),
      "predicado-inedito",
      ({ fact }) => fact.processTypeDefinitionId === DEMO_WORKSPACE_PROCESS_TYPES.documentIntake,
    );
    const queue: WorkspaceQueueDefinition = {
      queueDefinitionId: "fila-inedita",
      labelSnapshot: "Fila inédita",
      order: 1,
      predicates: [{ predicateExecutorId: "predicado-inedito" }],
    };
    const projected = projectProcessFacts({
      sources: demonstrationProcessSources,
      registry: createSecretaryProcessRegistry(),
    });
    const projection = projectWorkspace({
      workspacePerspectiveDefinitionId: SECRETARY_PERSPECTIVE_ID,
      context: createSecretaryAccessContext(),
      accessPolicy: demonstrationWorkspaceAccessPolicy,
      facts: projected.facts,
      queueDefinitions: [queue],
      temporalWindows: demonstrationTemporalWindows,
      predicateRegistry: predicates,
      producedAt: "2027-02-25T12:00:00.000Z",
    });
    expect(queueItemsOf(projection, "fila-inedita").length).toBeGreaterThan(0);
  });

  it("predicado sem executor registrado não classifica nem presume", () => {
    const projected = projectProcessFacts({
      sources: demonstrationProcessSources,
      registry: createSecretaryProcessRegistry(),
    });
    const projection = projectWorkspace({
      workspacePerspectiveDefinitionId: SECRETARY_PERSPECTIVE_ID,
      context: createSecretaryAccessContext(),
      accessPolicy: demonstrationWorkspaceAccessPolicy,
      facts: projected.facts,
      queueDefinitions: [
        {
          queueDefinitionId: "fila-sem-executor",
          labelSnapshot: "Fila sem executor",
          order: 1,
          predicates: [{ predicateExecutorId: "predicado-inexistente" }],
        },
      ],
      temporalWindows: demonstrationTemporalWindows,
      producedAt: "2027-02-25T12:00:00.000Z",
    });
    expect(queueItemsOf(projection, "fila-sem-executor")).toHaveLength(0);
    expect(projection.diagnostics.join(" ")).toContain("não possui executor registrado");
  });
});

describe("13G — janelas temporais configuráveis", () => {
  it("janela de prazo muda o conteúdo da fila sem alterar código", () => {
    const wide = buildSecretaryWorkspaceProjection();
    const narrow = buildSecretaryWorkspaceProjection({
      temporalWindows: [
        {
          windowDefinitionId: "janela-prazo-proximo-demo",
          labelSnapshot: "Janela estreita",
          days: 1,
        },
        {
          windowDefinitionId: "janela-concluido-recentemente-demo",
          labelSnapshot: "Conclusões recentes",
          days: 15,
        },
      ],
    });
    expect(queueItemsOf(wide, DEADLINE_QUEUE).length).toBeGreaterThan(
      queueItemsOf(narrow, DEADLINE_QUEUE).length,
    );
  });

  it("janela de conclusões recentes também é configuração", () => {
    const projection = buildSecretaryWorkspaceProjection({
      context: createSecretaryAccessContext({
        institutionalScopeIds: ["demo-001", "demo-002"],
      }),
    });
    expect(queueItemsOf(projection, RECENT_QUEUE).length).toBeGreaterThan(0);
    const zeroed = buildSecretaryWorkspaceProjection({
      context: createSecretaryAccessContext({
        institutionalScopeIds: ["demo-001", "demo-002"],
      }),
      temporalWindows: [
        {
          windowDefinitionId: "janela-concluido-recentemente-demo",
          labelSnapshot: "Sem janela",
          days: 0,
        },
      ],
    });
    expect(queueItemsOf(zeroed, RECENT_QUEUE)).toHaveLength(0);
  });

  it("janela não declarada deixa a fila vazia em vez de presumir dias", () => {
    const projection = buildSecretaryWorkspaceProjection({ temporalWindows: [] });
    expect(queueItemsOf(projection, DEADLINE_QUEUE)).toHaveLength(0);
  });
});

describe("13G — Ficha Integrada composicional", () => {
  it("monta seções a partir do registro, não de um componente monolítico", () => {
    const { sections } = buildSecretaryIntegratedProfile({ subjectEntityId: "alu-001" });
    expect(sections.map((section) => section.sectionDefinitionId)).toEqual([
      "secao-identidade-e-vinculo",
      "secao-inscricao-letiva",
      "secao-enturmacao",
      "secao-mobilidade",
      "secao-dossie",
    ]);
  });

  it("aceita uma seção inédita registrada dinamicamente", () => {
    const registry = createSecretaryProfileSectionRegistry();
    registerProfileSection(registry, {
      sectionDefinitionId: "secao-transporte-escolar-futura",
      provider: () => ({
        sectionDefinitionId: "secao-transporte-escolar-futura",
        labelSnapshot: "Transporte escolar",
        order: 9,
        entries: [{ term: "Rota", detailSnapshot: "Demonstrativa" }],
        actions: [],
        diagnostics: [],
      }),
    });
    const projection = buildSecretaryWorkspaceProjection();
    const { sections } = projectIntegratedProfile({
      subjectEntityId: "alu-001",
      context: createSecretaryAccessContext(),
      projection,
      registry,
    });
    expect(sections.at(-1)?.sectionDefinitionId).toBe("secao-transporte-escolar-futura");
  });

  it("seções recebem apenas fatos autorizados do sujeito", () => {
    const { sections } = buildSecretaryIntegratedProfile({ subjectEntityId: "alu-001" });
    const dossier = sections.find((section) => section.sectionDefinitionId === "secao-dossie")!;
    expect(JSON.stringify(dossier)).not.toContain("Anotação pedagógica restrita");
  });

  it("ficha sem provedores registrados não inventa conteúdo", () => {
    const projection = buildSecretaryWorkspaceProjection();
    const { sections } = projectIntegratedProfile({
      subjectEntityId: "alu-001",
      context: createSecretaryAccessContext(),
      projection,
      registry: createProfileSectionRegistry(),
    });
    expect(sections).toHaveLength(0);
  });

  it("apresenta datas no padrão brasileiro", () => {
    const { sections } = buildSecretaryIntegratedProfile({ subjectEntityId: "alu-001" });
    const enrollment = sections.find(
      (section) => section.sectionDefinitionId === "secao-inscricao-letiva",
    )!;
    expect(enrollment.entries[0]?.detailSnapshot).toContain(
      formatAcademicDate("2027-02-03"),
    );
    expect(JSON.stringify(sections)).not.toContain("2027-02-03 ·");
  });
});

describe("13G — segunda perspectiva fictícia sobre os mesmos fatos", () => {
  /** Perspectiva fictícia de acompanhamento; NÃO é a futura 13H. */
  const followUpContext = {
    actorId: "agente-perspectiva-ficticia",
    capacityDefinitionIds: [
      DEMO_WORKSPACE_CAPACITIES.consultStudentLife,
      DEMO_WORKSPACE_CAPACITIES.readPedagogicalNote,
    ],
    institutionalScopes: [
      {
        entityKindDefinitionId: DEMO_WORKSPACE_SCOPE_KINDS.schoolUnit,
        entityId: "demo-001",
      },
    ],
    processingPurposeDefinitionId: DEMO_WORKSPACE_PURPOSES.pedagogicalFollowUp,
    readOperationDefinitionId: DEMO_WORKSPACE_OPERATIONS.readOperationalMetadata,
    requestedAt: "2027-02-25T12:00:00.000Z",
  };

  const followUpQueues: readonly WorkspaceQueueDefinition[] = [
    {
      queueDefinitionId: "fila-ficticia-com-requisito",
      labelSnapshot: "Casos com requisito em aberto",
      order: 1,
      predicates: [
        { predicateExecutorId: WORKSPACE_PREDICATE_EXECUTOR_IDS.hasOpenRequirement },
      ],
    },
  ];

  it("o mesmo framework produz projeção diferente para outra perspectiva", () => {
    const secretary = buildSecretaryWorkspaceProjection();
    const followUp = buildSecretaryWorkspaceProjection({
      context: followUpContext,
      queueDefinitions: followUpQueues,
    });
    expect(followUp.queues.map((queue) => queue.definition.queueDefinitionId)).toEqual([
      "fila-ficticia-com-requisito",
    ]);
    expect(followUp.processingPurposeDefinitionId).not.toBe(
      secretary.processingPurposeDefinitionId,
    );
    expect(followUp.authorizedItems.map((item) => item.source.entityId)).toContain(
      "doc-demo-002",
    );
  });

  it("outra perspectiva não herda as ações executáveis da Secretaria", () => {
    const followUp = buildSecretaryWorkspaceProjection({
      context: followUpContext,
      queueDefinitions: followUpQueues,
    });
    const executable = followUp.authorizedItems
      .flatMap((item) => item.actions)
      .filter(isActionExecutable);
    expect(executable).toHaveLength(0);
  });
});

describe("13G — auditoria anti-rigidez e fronteiras", () => {
  const engineSource = readFileSync("src/features/workspace/workspace-engine.ts", "utf8");
  const typesSource = readFileSync("src/features/workspace/workspace-types.ts", "utf8");
  const searchSource = readFileSync("src/features/workspace/workspace-search.ts", "utf8");

  function withoutComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
      .join("\n");
  }

  it("o núcleo não conhece Secretaria, Orientação, Direção nem Supervisão", () => {
    const code = withoutComments(engineSource) + withoutComments(typesSource);
    for (const term of ["Secretaria", "Orientação", "Direção", "Supervisão", "secretaria"]) {
      expect(code).not.toContain(term);
    }
  });

  it("o núcleo não conhece matrícula, turma, transferência nem documento", () => {
    const code = withoutComments(engineSource) + withoutComments(searchSource);
    for (const term of ["matricula", "matrícula", "turma", "transferencia", "documento"]) {
      expect(code.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("o núcleo não fixa janelas temporais nem 'schoolId'", () => {
    const code = withoutComments(engineSource) + withoutComments(typesSource);
    expect(code).not.toContain("schoolId");
    expect(code).not.toMatch(/days\s*[:=]\s*\d+/);
  });

  it("não há indicador estatístico, taxa ou gráfico na projeção", () => {
    const projection = buildSecretaryWorkspaceProjection();
    const keys = JSON.stringify(projection).toLowerCase();
    for (const term of ["taxa", "percentual", "indicador", "media", "grafico"]) {
      expect(keys).not.toContain(term);
    }
  });

  it("a projeção não cria estado, nota, frequência nem situação acadêmica", () => {
    const projection = buildSecretaryWorkspaceProjection();
    const serialized = JSON.stringify(projection).toLowerCase();
    for (const term of ["aprovado", "reprovado", "nota", "frequencia", "boletim"]) {
      expect(serialized).not.toContain(term);
    }
  });
});
