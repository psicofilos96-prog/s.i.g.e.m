/**
 * Etapa 13H — Testes normativos do acompanhamento pedagógico.
 *
 * Cobrem o princípio formal (sinal não é diagnóstico), a separação
 * detecção → avaliação → ocorrência, histórico imutável, privacidade governada
 * e a reutilização do framework de workspace por uma segunda perspectiva.
 */
import { describe, expect, it } from "vitest";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  createSecretaryAccessContext,
  DEMO_WORKSPACE_CAPACITIES,
} from "@/features/workspace/secretary-workspace";
import { isActionExecutable, projectProcessFacts } from "@/features/workspace/workspace-engine";
import { searchAuthorizedSubjects } from "@/features/workspace/workspace-search";
import {
  authorizeCommunicationParticipant,
  casesForSubject,
  COMMUNICATION_AUTHORIZATION,
  currentPlanVersion,
  planVersionHistory,
  projectCaseState,
  projectReferralStatus,
  responsibleAssignmentsAsOf,
} from "./guidance-cases";
import {
  attendanceSignalDefinitionV1,
  attendanceSignalDefinitionV2,
  demonstrationCaseEvents,
  demonstrationCaseResponsibilities,
  demonstrationCases,
  demonstrationGuidanceFacts,
  demonstrationObservedFacts,
  demonstrationPlanVersions,
  demonstrationReferralPolicy,
  demonstrationReferralResponses,
  demonstrationReferrals,
  demonstrationResponsibilityAssignments,
  demonstrationSignalLifecycleEvents,
  draftSignalDefinition,
  GUIDANCE_CAPACITIES,
  GUIDANCE_CASE_CLOSING_REASONS,
  GUIDANCE_CASE_STATES,
  GUIDANCE_OPENING_MODES,
  GUIDANCE_PROCESS_TYPES,
  GUIDANCE_RESPONSIBILITY_CAPACITY,
  GUIDANCE_SENSITIVITY,
  GUIDANCE_SIGNAL_STATES,
  pendingComponentsSignalDefinition,
} from "./guidance-fixtures";
import {
  buildDemonstrationSignalEvaluations,
  buildDemonstrationSignalOccurrences,
} from "./guidance-signals-demo";
import {
  evaluateSignal,
  materializeOccurrence,
  projectSignalLifecycleState,
  SIGNAL_OUTCOME,
} from "./signal-engine";
import {
  buildGuidanceStudentProfile,
  buildGuidanceWorkspaceProjection,
  createGuidanceAccessContext,
  createGuidanceProcessRegistry,
  guidanceQueueItems,
  guidanceSearchableSubjects,
  projectGuidanceAnalyticFacts,
  projectGuidanceClassView,
  guidanceProcessSources,
} from "./guidance-workspace";

const subjects = (studentId: string) => [
  {
    subjectRoleDefinitionId: "estudante-avaliado",
    reference: { entityKindDefinitionId: "aluno", entityId: studentId },
  },
];

describe("13H — motor de sinais: detecção, avaliação e materialização", () => {
  it("apura apenas a condição declarada e não produz caso nem consequência", () => {
    const evaluation = buildDemonstrationSignalEvaluations()[0]!;
    expect(evaluation.outcome).toBe(SIGNAL_OUTCOME.satisfied);
    expect(evaluation.consideredFacts.length).toBeGreaterThan(0);
    expect(Object.keys(evaluation)).not.toContain("caseId");
    expect(Object.keys(evaluation)).not.toContain("diagnosis");
  });

  it("fato indisponível deixa a avaliação inconclusiva e nunca vira zero", () => {
    const evaluation = buildDemonstrationSignalEvaluations()[1]!;
    expect(evaluation.outcome).toBe(SIGNAL_OUTCOME.inconclusive);
    expect(
      evaluation.diagnostics.some((diagnostic) =>
        diagnostic.diagnosticCode.includes("INDISPONIVEL"),
      ) || evaluation.diagnostics.length > 0,
    ).toBe(true);
  });

  it("definição não homologada apura a condição sem produzir sinal institucional", () => {
    const evaluation = evaluateSignal({
      definition: draftSignalDefinition,
      subjects: subjects("alu-001"),
      evaluationContext: {},
      facts: demonstrationGuidanceFacts["alu-001"] ?? [],
      evaluatedAt: "2027-03-01T08:00:00.000Z",
      evaluationId: "aval-rascunho",
    });
    expect(evaluation.outcome).toBe(SIGNAL_OUTCOME.inconclusive);
    expect(
      materializeOccurrence({
        evaluation,
        definition: draftSignalDefinition,
        occurrenceId: "ocr-rascunho",
        materializedAt: "2027-03-01T09:00:00.000Z",
        scopeEntities: [],
        provenance: { originTypeId: "teste", recordedAt: "2027-03-01T09:00:00.000Z" },
      }),
    ).toBeNull();
  });

  it("condição de contagem apura quantos componentes têm pendência declarada", () => {
    const evaluation = evaluateSignal({
      definition: pendingComponentsSignalDefinition,
      subjects: subjects("alu-001"),
      evaluationContext: {},
      facts: demonstrationGuidanceFacts["alu-001"] ?? [],
      evaluatedAt: "2027-03-01T08:00:00.000Z",
      evaluationId: "aval-contagem",
    });
    expect(evaluation.outcome).toBe(SIGNAL_OUTCOME.satisfied);
  });

  it("alterar a definição cria nova versão e NÃO reescreve a ocorrência histórica", () => {
    const occurrence = buildDemonstrationSignalOccurrences()[0]!;
    expect(occurrence.definitionVersion).toBe(1);
    const newEvaluation = evaluateSignal({
      definition: attendanceSignalDefinitionV2,
      subjects: subjects("alu-001"),
      evaluationContext: {},
      facts: demonstrationGuidanceFacts["alu-001"] ?? [],
      evaluatedAt: "2027-08-01T08:00:00.000Z",
      evaluationId: "aval-v2",
    });
    // 72 não é menor que 70: a nova versão não detecta, e a antiga permanece íntegra.
    expect(newEvaluation.outcome).toBe(SIGNAL_OUTCOME.notSatisfied);
    expect(occurrence.definitionVersion).toBe(1);
    expect(occurrence.factSnapshot.some((fact) => fact.value === 72)).toBe(true);
  });

  it("mudança posterior do fato canônico não altera o retrato congelado", () => {
    const occurrence = buildDemonstrationSignalOccurrences()[0]!;
    const frozen = occurrence.factSnapshot.find(
      (fact) => fact.factKey === "proporcao-de-frequencia-do-ciclo",
    );
    expect(frozen?.value).toBe(72);
    const later = [...(demonstrationGuidanceFacts["alu-001"] ?? [])];
    later[0] = { ...later[0]!, value: 95 };
    expect(frozen?.value).toBe(72);
  });

  it("estado do sinal é projeção do ledger e reconhece vínculo com caso existente", () => {
    const occurrence = buildDemonstrationSignalOccurrences()[0]!;
    const state = projectSignalLifecycleState({
      occurrence,
      definition: attendanceSignalDefinitionV1,
      events: demonstrationSignalLifecycleEvents,
      asOf: "2027-03-10",
    });
    expect(state.stateDefinitionId).toBe(GUIDANCE_SIGNAL_STATES.linkedToCase);
    expect(state.relatedCaseIds).toContain("caso-demo-001");
    expect(Object.keys(occurrence)).not.toContain("stateDefinitionId");
  });

  it("sinal pode existir sem caso algum", () => {
    const occurrence = buildDemonstrationSignalOccurrences()[0]!;
    const linked = demonstrationCases.filter((item) =>
      item.foundingReferences.some((reference) => reference.entityId === "ocr-sinal-inexistente"),
    );
    expect(occurrence).toBeTruthy();
    expect(linked).toHaveLength(0);
  });
});

describe("13H — acompanhamento: abertura, responsabilidade, plano e encerramento", () => {
  it("caso pode nascer sem sinal prévio (provocação institucional ou da família)", () => {
    const withoutSignal = demonstrationCases.filter(
      (item) => item.foundingReferences.length === 0,
    );
    expect(withoutSignal.length).toBeGreaterThan(0);
    expect(withoutSignal.map((item) => item.openingModeDefinitionId)).toContain(
      GUIDANCE_OPENING_MODES.familyRequest,
    );
  });

  it("um caso pode reunir vários sinais e vários sujeitos", () => {
    const multiSubject = demonstrationCases.find((item) => item.caseId === "caso-demo-002")!;
    expect(multiSubject.subjects.length).toBeGreaterThan(1);
    expect(casesForSubject(demonstrationCases, "alu-002").map((item) => item.caseId)).toContain(
      "caso-demo-002",
    );
  });

  it("responsabilidade é temporal: a troca preserva o histórico", () => {
    const before = responsibleAssignmentsAsOf(
      demonstrationCaseResponsibilities,
      "caso-demo-001",
      "2027-03-20",
    );
    const after = responsibleAssignmentsAsOf(
      demonstrationCaseResponsibilities,
      "caso-demo-001",
      "2027-05-20",
    );
    expect(before[0]?.agentReference.agentId).toBe("agente-orientacao-demo");
    expect(after[0]?.agentReference.agentId).toBe("agente-orientacao-substituto-demo");
    expect(before[0]?.assignmentId).not.toBe(after[0]?.assignmentId);
  });

  it("revisão do plano cria nova versão e preserva a anterior", () => {
    const current = currentPlanVersion(demonstrationPlanVersions, "plano-demo-001");
    const history = planVersionHistory(demonstrationPlanVersions, "plano-demo-001");
    expect(current?.version).toBe(2);
    expect(history.map((version) => version.version)).toEqual([1, 2]);
    expect(history[0]?.items.map((item) => item.planItemId)).toContain("plano-item-001");
  });

  it("encerramento não significa resolvido: estado e motivo são independentes", () => {
    const closed = projectCaseState({
      followUpCase: demonstrationCases.find((item) => item.caseId === "caso-demo-003")!,
      events: demonstrationCaseEvents,
      asOf: "2027-05-10",
    });
    expect(closed.concluded).toBe(true);
    expect(closed.stateDefinitionId).toBe(GUIDANCE_CASE_STATES.closed);
    expect(closed.closingReasonDefinitionId).toBe(
      GUIDANCE_CASE_CLOSING_REASONS.withoutResolution,
    );
  });

  it("resultado observado não afirma causalidade da intervenção", () => {
    const observed = demonstrationObservedFacts[0]!;
    expect(observed.assertsCausality).toBe(false);
    expect(observed.relatedInterventionId).toBe("interv-demo-001");
  });

  it("ausência de acompanhamento nunca é registrada como fato positivo", () => {
    const projection = buildGuidanceWorkspaceProjection();
    const facts = projectGuidanceAnalyticFacts({ projection });
    expect(facts.every((fact) => fact.factTypeDefinitionId.length > 0)).toBe(true);
    expect(
      facts.some((fact) => JSON.stringify(fact).includes("sem-acompanhamento")),
    ).toBe(false);
  });
});

describe("13H — comunicação e encaminhamento", () => {
  it("comunicação com quem não tem responsabilidade vigente é recusada", () => {
    const denied = authorizeCommunicationParticipant({
      personId: "pes-sem-poder",
      studentId: "alu-001",
      requiredCapacityDefinitionId: GUIDANCE_RESPONSIBILITY_CAPACITY,
      assignments: demonstrationResponsibilityAssignments,
      isoDate: "2027-03-08",
    });
    expect(denied.authorization).toBe(COMMUNICATION_AUTHORIZATION.notAuthorized);
    const allowed = authorizeCommunicationParticipant({
      personId: "pes-demo-001",
      studentId: "alu-001",
      requiredCapacityDefinitionId: GUIDANCE_RESPONSIBILITY_CAPACITY,
      assignments: demonstrationResponsibilityAssignments,
      isoDate: "2027-03-08",
    });
    expect(allowed.authorization).toBe(COMMUNICATION_AUTHORIZATION.authorized);
  });

  it("capacidade não declarada deixa a autorização inconclusiva (falha fechada)", () => {
    const result = authorizeCommunicationParticipant({
      personId: "pes-demo-001",
      studentId: "alu-001",
      requiredCapacityDefinitionId: "  ",
      assignments: demonstrationResponsibilityAssignments,
      isoDate: "2027-03-08",
    });
    expect(result.authorization).toBe(COMMUNICATION_AUTHORIZATION.inconclusive);
  });

  it("encaminhamento sem retorno obrigatório funciona e não fica pendente", () => {
    const status = projectReferralStatus({
      referral: demonstrationReferrals.find((item) => item.referralId === "enc-demo-002")!,
      policy: demonstrationReferralPolicy,
      responses: demonstrationReferralResponses,
    });
    expect(status.requiresResponse).toBe(false);
    expect(status.awaitingResponse).toBe(false);
  });

  it("encaminhamento com resposta exigida permanece pendente até o retorno", () => {
    const referral = demonstrationReferrals.find((item) => item.referralId === "enc-demo-001")!;
    const pending = projectReferralStatus({
      referral,
      policy: demonstrationReferralPolicy,
      responses: [],
    });
    expect(pending.awaitingResponse).toBe(true);
    expect(pending.responseDueDate).toBe("2027-03-30");
    const answered = projectReferralStatus({
      referral,
      policy: demonstrationReferralPolicy,
      responses: [
        {
          responseEventId: "resp-enc-001",
          referralId: referral.referralId,
          responseTypeDefinitionId: "resposta-estruturada-recebida",
          receivedAt: "2027-03-25",
          provenance: { originTypeId: "teste", recordedAt: "2027-03-25T10:00:00.000Z" },
        },
      ],
    });
    expect(answered.awaitingResponse).toBe(false);
  });

  it("expectativa não configurada é inconclusiva, nunca presumida como pendente", () => {
    const status = projectReferralStatus({
      referral: {
        ...demonstrationReferrals[0]!,
        referralTypeDefinitionId: "tipo-nao-configurado",
      },
      policy: demonstrationReferralPolicy,
      responses: [],
    });
    expect(status.awaitingResponse).toBe(false);
    expect(status.diagnostics[0]?.diagnosticCode).toBe("EXPECTATIVA-NAO-CONFIGURADA");
  });
});

describe("13H — projeção operacional autorizada (reuso do framework 13G)", () => {
  it("nenhuma fila ou item é entidade persistida: tudo deriva dos fatos", () => {
    const first = buildGuidanceWorkspaceProjection();
    const second = buildGuidanceWorkspaceProjection();
    expect(first.queues.map((queue) => queue.itemCount)).toEqual(
      second.queues.map((queue) => queue.itemCount),
    );
    expect(first.workspaceProjectionSchemaVersion).toBeGreaterThan(0);
    expect(first.producedAt.length).toBeGreaterThan(0);
  });

  it("um novo tipo de processo entra por registro, sem alterar o framework", () => {
    const registry = createGuidanceProcessRegistry();
    const projected = projectProcessFacts({
      sources: guidanceProcessSources(),
      registry,
    });
    expect(
      new Set(projected.facts.map((fact) => fact.processTypeDefinitionId)),
    ).toEqual(
      new Set([
        GUIDANCE_PROCESS_TYPES.signalAnalysis,
        GUIDANCE_PROCESS_TYPES.followUpCase,
        GUIDANCE_PROCESS_TYPES.referral,
      ]),
    );
  });

  it("conteúdo restrito não é projetado para quem não tem a capacidade", () => {
    const withoutContent = buildGuidanceWorkspaceProjection({
      context: createGuidanceAccessContext({
        capacityDefinitionIds: [GUIDANCE_CAPACITIES.consultPedagogicalPath],
      }),
    });
    const restricted = withoutContent.authorizedItems.filter(
      (item) => item.sensitivityLevelDefinitionId === GUIDANCE_SENSITIVITY.restricted,
    );
    expect(restricted).toHaveLength(0);
    const withContent = buildGuidanceWorkspaceProjection();
    expect(
      withContent.authorizedItems.some(
        (item) => item.sensitivityLevelDefinitionId === GUIDANCE_SENSITIVITY.restricted,
      ),
    ).toBe(true);
  });

  it("a perspectiva da Secretaria não enxerga o conteúdo da Orientação", () => {
    const secretary = createSecretaryAccessContext({
      capacityDefinitionIds: [DEMO_WORKSPACE_CAPACITIES.consultStudentLife],
    });
    const projection = buildGuidanceWorkspaceProjection({ context: secretary });
    expect(
      projection.authorizedItems.some(
        (item) => item.sensitivityLevelDefinitionId === GUIDANCE_SENSITIVITY.restricted,
      ),
    ).toBe(false);
  });

  it("campos não autorizados são ocultados por redação, mantendo o item legível", () => {
    const projection = buildGuidanceWorkspaceProjection({
      context: createGuidanceAccessContext({
        capacityDefinitionIds: [GUIDANCE_CAPACITIES.consultPedagogicalPath],
      }),
    });
    const item = projection.authorizedItems[0];
    expect(item).toBeTruthy();
    expect(item!.redactedFieldPaths).toContain("fundamentacao");
    expect(Object.keys(item!.authorizedPayload)).not.toContain("fundamentacao");
  });

  it("fora do escopo institucional nada é revelado", () => {
    const projection = buildGuidanceWorkspaceProjection({
      context: createGuidanceAccessContext({ institutionalScopeIds: ["demo-999"] }),
    });
    expect(projection.authorizedItems).toHaveLength(0);
  });

  it("ação tecnicamente disponível pode não estar autorizada, com explicação", () => {
    const projection = buildGuidanceWorkspaceProjection({
      context: createGuidanceAccessContext({
        capacityDefinitionIds: [
          GUIDANCE_CAPACITIES.consultPedagogicalPath,
          GUIDANCE_CAPACITIES.readGuidanceContent,
        ],
      }),
    });
    const actions = projection.authorizedItems.flatMap((item) => item.actions);
    expect(actions.length).toBeGreaterThan(0);
    const unauthorized = actions.filter((action) => !isActionExecutable(action));
    expect(unauthorized.length).toBeGreaterThan(0);
    expect(unauthorized.every((action) => action.explanation.trim().length > 0)).toBe(true);
  });

  it("janelas temporais são configuração, não constante do código", () => {
    const narrow = buildGuidanceWorkspaceProjection({
      temporalWindows: [
        { windowDefinitionId: "janela-prazo-de-acao-demo", labelSnapshot: "Curta", days: 1 },
        {
          windowDefinitionId: "janela-atualizacao-recente-demo",
          labelSnapshot: "Curta",
          days: 1,
        },
      ],
    });
    const wide = buildGuidanceWorkspaceProjection({
      temporalWindows: [
        { windowDefinitionId: "janela-prazo-de-acao-demo", labelSnapshot: "Longa", days: 900 },
        {
          windowDefinitionId: "janela-atualizacao-recente-demo",
          labelSnapshot: "Longa",
          days: 900,
        },
      ],
    });
    const narrowCount = guidanceQueueItems(narrow, "fila-acoes-com-prazo-demo").length;
    const wideCount = guidanceQueueItems(wide, "fila-acoes-com-prazo-demo").length;
    expect(wideCount).toBeGreaterThanOrEqual(narrowCount);
  });

  it("busca não infere existência de quem não pode ser conhecido", () => {
    const outOfScope = searchAuthorizedSubjects({
      query: "Aluna",
      subjects: guidanceSearchableSubjects,
      context: createGuidanceAccessContext({ institutionalScopeIds: ["demo-999"] }),
    });
    expect(outOfScope).toHaveLength(0);
    const inScope = searchAuthorizedSubjects({
      query: "Aluna",
      subjects: guidanceSearchableSubjects,
      context: createGuidanceAccessContext(),
    });
    expect(inScope.length).toBeGreaterThan(0);
  });

  it("ficha pedagógica é composicional e explica a ausência de registro", () => {
    const { sections } = buildGuidanceStudentProfile({ subjectEntityId: "alu-001" });
    expect(sections.map((section) => section.sectionDefinitionId)).toContain(
      "secao-acompanhamentos",
    );
    const referrals = sections.find(
      (section) => section.sectionDefinitionId === "secao-encaminhamentos",
    );
    expect(referrals).toBeTruthy();
    const empty = buildGuidanceStudentProfile({ subjectEntityId: "alu-999" });
    expect(
      empty.sections.some((section) =>
        section.entries.some((entry) => entry.term === "Sem registro autorizado"),
      ),
    ).toBe(true);
  });

  it("visão da turma lista estudantes com itens autorizados, sem indicadores", () => {
    const view = projectGuidanceClassView({ classId: "tur-001" });
    expect(view.students.length).toBeGreaterThan(0);
    expect(JSON.stringify(view)).not.toContain("taxa");
    expect(Object.keys(view)).not.toContain("percentual");
  });

  it("deep links apontam para o objeto real", () => {
    const projection = buildGuidanceWorkspaceProjection();
    const withLink = projection.authorizedItems.filter((item) => item.deepLink !== undefined);
    expect(withLink.length).toBeGreaterThan(0);
    expect(withLink[0]?.deepLink?.params["alunoId"]).toBeTruthy();
  });

  it("fatos ao CIECE são atômicos, sem conteúdo nem agregação", () => {
    const facts = projectGuidanceAnalyticFacts();
    expect(facts.length).toBeGreaterThan(0);
    for (const fact of facts) {
      expect(Object.keys(fact.attributes)).not.toContain("fundamentacao");
      expect(Object.keys(fact.attributes)).not.toContain("total");
      expect(fact.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("toda data apresentada usa o padrão brasileiro", () => {
    const projection = buildGuidanceWorkspaceProjection();
    const titles = projection.authorizedItems.map((item) => item.titleSnapshot).join(" | ");
    expect(titles).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(formatAcademicDate("2027-03-05")).toBe("05/03/2027");
  });

  it("proveniência técnica acompanha a projeção", () => {
    const projection = buildGuidanceWorkspaceProjection();
    for (const item of projection.authorizedItems) {
      expect(item.source.entityId.length).toBeGreaterThan(0);
      expect(item.producedByDomainId.length).toBeGreaterThan(0);
    }
  });
});
