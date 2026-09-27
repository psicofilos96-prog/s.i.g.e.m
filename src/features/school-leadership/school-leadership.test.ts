/**
 * Etapa 13I — Auditoria da Direção Escolar como workspace institucional.
 *
 * Cada bloco corresponde a um dos 18 refinamentos exigidos na aprovação.
 */
import { describe, expect, it } from "vitest";

import {
  ALTERNATIVE_ADMISSIBILITY,
  COMPETENCE_OUTCOME,
  OVERRIDE_OUTCOME,
  assessDecisionProcess,
  createActEmitterRegistry,
  createOverrideConstraintRegistry,
  currentDecisionRecord,
  decideInstitutionalProcess,
  evaluateConfigurationOverride,
  exceptionPreservesGeneralRule,
  explainHistoricalDecision,
  rectifyDecision,
  resolveCompetence,
} from "@/features/institutional-decisions/decision-engine";
import {
  LEADERSHIP_CAPACITIES,
  LEADERSHIP_PROCESS_TYPES,
  LEADERSHIP_SCOPE_KINDS,
  demonstrationAllowedOverrides,
  demonstrationClosingImpediments,
  demonstrationCompetenceGrants,
  demonstrationConfigurationDelegations,
  demonstrationDecisionProcesses,
  demonstrationPolicyScopes,
  documentDependentDecisionType,
  exceptionalEnrollmentDecisionType,
} from "@/features/institutional-decisions/decision-fixtures";
import type { InstitutionalDecisionRecord } from "@/features/institutional-decisions/decision-types";
import {
  LEADERSHIP_PROCESS_STATES,
  buildLeadershipStudentProfile,
  buildLeadershipWorkspaceProjection,
  createLeadershipAccessContext,
  leadershipQueueItems,
  projectDecisionProcessState,
  projectLeadershipInstitutionalTimeline,
  projectLeadershipNavigationTree,
  projectLeadershipUnitCompliance,
} from "./leadership-workspace";

const unitScope = [
  { entityKindDefinitionId: LEADERSHIP_SCOPE_KINDS.schoolUnit, entityId: "demo-001" },
];

const exceptionalProcess = demonstrationDecisionProcesses[0]!;
const documentProcess = demonstrationDecisionProcesses[1]!;

describe("13I.1 — cargo não autoriza; capacidade explícita autoriza", () => {
  it("dois agentes com o mesmo cargo possuem competências diferentes", () => {
    const withCapacity = resolveCompetence({
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      capacityDefinitionId: LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
      scopeEntities: unitScope,
      isoDate: "2027-05-10",
    });
    const withoutCapacity = resolveCompetence({
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-b",
      capacityDefinitionId: LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
      scopeEntities: unitScope,
      isoDate: "2027-05-10",
    });
    expect(withCapacity.outcome).toBe(COMPETENCE_OUTCOME.held);
    expect(withoutCapacity.outcome).toBe(COMPETENCE_OUTCOME.notHeld);
    // Ambos têm o mesmo rótulo de cargo.
    expect(withCapacity.grants[0]?.positionLabelSnapshot).toBe("Diretor escolar");
  });
});

describe("13I.2 — escopo institucional limita a competência", () => {
  it("competência em outra unidade não alcança esta unidade", () => {
    const resolution = resolveCompetence({
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-c",
      capacityDefinitionId: LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
      scopeEntities: unitScope,
      isoDate: "2027-05-10",
    });
    expect(resolution.outcome).toBe(COMPETENCE_OUTCOME.notHeld);
  });
});

describe("13I.3 — vigência da competência", () => {
  it("capacidade encerrada não autoriza depois do fim da vigência", () => {
    const before = resolveCompetence({
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      capacityDefinitionId: LEADERSHIP_CAPACITIES.authorizeException,
      scopeEntities: unitScope,
      isoDate: "2027-04-20",
    });
    const after = resolveCompetence({
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      capacityDefinitionId: LEADERSHIP_CAPACITIES.authorizeException,
      scopeEntities: unitScope,
      isoDate: "2027-05-10",
    });
    expect(before.outcome).toBe(COMPETENCE_OUTCOME.held);
    expect(after.outcome).toBe(COMPETENCE_OUTCOME.notHeld);
  });
});

describe("13I.4 — substituição temporária da Direção", () => {
  it("é nova concessão com vigência própria, sem trocar regra alguma", () => {
    const duringSubstitution = resolveCompetence({
      grants: demonstrationCompetenceGrants,
      agentId: "agente-substituto-d",
      capacityDefinitionId: LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
      scopeEntities: unitScope,
      isoDate: "2027-05-10",
    });
    const afterSubstitution = resolveCompetence({
      grants: demonstrationCompetenceGrants,
      agentId: "agente-substituto-d",
      capacityDefinitionId: LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
      scopeEntities: unitScope,
      isoDate: "2027-06-01",
    });
    expect(duringSubstitution.outcome).toBe(COMPETENCE_OUTCOME.held);
    expect(duringSubstitution.grants[0]?.delegationOfGrantId).toBe("concessao-002");
    expect(afterSubstitution.outcome).toBe(COMPETENCE_OUTCOME.notHeld);
  });
});

describe("13I.5 — a decisão sempre decorre de uma regra que a exige", () => {
  it("a avaliação publica a política exigente e sua versão", () => {
    const assessment = assessDecisionProcess({
      process: exceptionalProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      isoDate: "2027-04-20",
    });
    expect(assessment.requiringPolicyId).toBe("pol-requisitos-de-inscricao-demo");
    expect(assessment.requiringPolicyVersion).toBe(2);
    expect(assessment.requirementNarrativeSnapshot).toContain("decisão institucional");
  });
});

describe("13I.6 — dado ausente produz inconclusão, nunca autorização", () => {
  it("alternativa dependente de fato indisponível fica inconclusiva", () => {
    const assessment = assessDecisionProcess({
      process: documentProcess,
      typeDefinition: documentDependentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      isoDate: "2027-05-10",
    });
    expect(assessment.admissibleAlternativeDefinitionIds).toEqual([]);
    expect(assessment.alternatives[0]?.admissibility).toBe(
      ALTERNATIVE_ADMISSIBILITY.inconclusive,
    );
  });

  it("fato indisponível é relatado por extenso, sem virar zero", () => {
    const assessment = assessDecisionProcess({
      process: exceptionalProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      isoDate: "2027-04-20",
    });
    expect(assessment.diagnostics.join(" ")).toContain("não é tratado como zero");
  });
});

describe("13I.7 — decisão registra objeto, fatos, competência e ato", () => {
  it("o registro congela os fatos considerados e as capacidades exercidas", () => {
    const plan = decideInstitutionalProcess({
      process: exceptionalProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      chosenAlternativeDefinitionId: "alternativa-autorizar-excepcionalmente",
      justificationSnapshot: "Fundamentação institucional demonstrativa.",
      effectiveDate: "2027-04-20",
      recordedAt: "2027-04-20T12:00:00.000Z",
      decisionRecordId: "decisao-001",
    });
    expect(plan.decision).not.toBeNull();
    expect(plan.decision?.consideredFactSnapshot).toHaveLength(
      exceptionalProcess.consideredFacts.length,
    );
    expect(plan.decision?.exercisedGrantIds).toEqual(["concessao-003"]);
    expect(plan.decision?.act?.actNatureDefinitionId).toBe(
      "ato-autorizacao-excepcional",
    );
  });

  it("a decisão não altera o fato nem o processo de origem", () => {
    const plan = decideInstitutionalProcess({
      process: exceptionalProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      chosenAlternativeDefinitionId: "alternativa-autorizar-excepcionalmente",
      justificationSnapshot: "Fundamentação institucional demonstrativa.",
      effectiveDate: "2027-04-20",
      recordedAt: "2027-04-20T12:00:00.000Z",
      decisionRecordId: "decisao-001",
    });
    expect(plan.unchangedProcess).toEqual(exceptionalProcess);
  });
});

describe("13I.8 — fundamentação exigida e falha fechada", () => {
  it("sem fundamentação nada é decidido", () => {
    const plan = decideInstitutionalProcess({
      process: exceptionalProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      chosenAlternativeDefinitionId: "alternativa-autorizar-excepcionalmente",
      effectiveDate: "2027-04-20",
      recordedAt: "2027-04-20T12:00:00.000Z",
      decisionRecordId: "decisao-002",
    });
    expect(plan.decision).toBeNull();
    expect(plan.diagnostics.join(" ")).toContain("fundamentação");
  });

  it("sem executor de ato registrado nada é decidido", () => {
    const emptyRegistry = new Map();
    const plan = decideInstitutionalProcess({
      process: exceptionalProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      chosenAlternativeDefinitionId: "alternativa-autorizar-excepcionalmente",
      justificationSnapshot: "Fundamentação demonstrativa.",
      effectiveDate: "2027-04-20",
      recordedAt: "2027-04-20T12:00:00.000Z",
      decisionRecordId: "decisao-003",
      actEmitterRegistry: emptyRegistry,
    });
    expect(plan.decision).toBeNull();
    expect(plan.diagnostics.join(" ")).toContain("não registrado");
  });

  it("definição sem homologação não produz decisão", () => {
    const plan = decideInstitutionalProcess({
      process: exceptionalProcess,
      typeDefinition: { ...exceptionalEnrollmentDecisionType, homologated: false },
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      chosenAlternativeDefinitionId: "alternativa-autorizar-excepcionalmente",
      justificationSnapshot: "Fundamentação demonstrativa.",
      effectiveDate: "2027-04-20",
      recordedAt: "2027-04-20T12:00:00.000Z",
      decisionRecordId: "decisao-004",
    });
    expect(plan.decision).toBeNull();
    expect(plan.diagnostics.join(" ")).toContain("sem homologação");
  });

  it("agente sem a capacidade exigida não decide, mesmo com o mesmo cargo", () => {
    const plan = decideInstitutionalProcess({
      process: exceptionalProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-b",
      chosenAlternativeDefinitionId: "alternativa-indeferir",
      justificationSnapshot: "Fundamentação demonstrativa.",
      effectiveDate: "2027-05-10",
      recordedAt: "2027-05-10T12:00:00.000Z",
      decisionRecordId: "decisao-005",
      actEmitterRegistry: createActEmitterRegistry(),
    });
    expect(plan.decision).toBeNull();
  });
});

describe("13I.9 — explicabilidade histórica da decisão", () => {
  it("decisão antiga permanece explicável mesmo após o fim da capacidade", () => {
    const plan = decideInstitutionalProcess({
      process: exceptionalProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      chosenAlternativeDefinitionId: "alternativa-autorizar-excepcionalmente",
      justificationSnapshot: "Fundamentação demonstrativa.",
      effectiveDate: "2027-04-20",
      recordedAt: "2027-04-20T12:00:00.000Z",
      decisionRecordId: "decisao-006",
    });
    const explanation = explainHistoricalDecision({
      decision: plan.decision!,
      grants: demonstrationCompetenceGrants,
    });
    expect(explanation.competentAtDecisionTime).toBe(true);
    expect(explanation.explanation.length).toBeGreaterThan(0);
  });
});

describe("13I.10 — exceção autorizada não altera a regra geral", () => {
  it("a configuração normativa permanece intacta", () => {
    const plan = decideInstitutionalProcess({
      process: exceptionalProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      chosenAlternativeDefinitionId: "alternativa-autorizar-excepcionalmente",
      justificationSnapshot: "Fundamentação demonstrativa.",
      effectiveDate: "2027-04-20",
      recordedAt: "2027-04-20T12:00:00.000Z",
      decisionRecordId: "decisao-007",
    });
    const result = exceptionPreservesGeneralRule({
      decision: plan.decision!,
      policyScope: demonstrationPolicyScopes[0]!,
    });
    expect(result.generalRuleChanged).toBe(false);
  });
});

describe("13I.11 — override de configuração dentro de limites declarados", () => {
  it("valor fora do limite é bloqueado", () => {
    const evaluation = evaluateConfigurationOverride({
      policyScope: demonstrationPolicyScopes[1]!,
      allowedOverrides: demonstrationAllowedOverrides,
      delegations: demonstrationConfigurationDelegations,
      agentCapacityDefinitionIds: [LEADERSHIP_CAPACITIES.configureUnitParameter],
      scopeEntities: unitScope,
      parameterDefinitionId: "parametro-dias-da-janela",
      proposedValue: 90,
      isoDate: "2027-05-10",
    });
    expect(evaluation.outcome).toBe(OVERRIDE_OUTCOME.blocked);
    expect(evaluation.unsatisfiedConstraintMessages.length).toBeGreaterThan(0);
  });

  it("valor dentro do limite é permitido", () => {
    const evaluation = evaluateConfigurationOverride({
      policyScope: demonstrationPolicyScopes[1]!,
      allowedOverrides: demonstrationAllowedOverrides,
      delegations: demonstrationConfigurationDelegations,
      agentCapacityDefinitionIds: [LEADERSHIP_CAPACITIES.configureUnitParameter],
      scopeEntities: unitScope,
      parameterDefinitionId: "parametro-dias-da-janela",
      proposedValue: 20,
      isoDate: "2027-05-10",
    });
    expect(evaluation.outcome).toBe(OVERRIDE_OUTCOME.allowed);
  });

  it("configuração da Rede sem override não é alterável pela unidade", () => {
    const evaluation = evaluateConfigurationOverride({
      policyScope: demonstrationPolicyScopes[0]!,
      allowedOverrides: demonstrationAllowedOverrides,
      delegations: demonstrationConfigurationDelegations,
      agentCapacityDefinitionIds: [LEADERSHIP_CAPACITIES.configureUnitParameter],
      scopeEntities: unitScope,
      parameterDefinitionId: "parametro-regra-de-situacao",
      proposedValue: "qualquer",
      isoDate: "2027-05-10",
    });
    expect(evaluation.outcome).toBe(OVERRIDE_OUTCOME.blocked);
  });

  it("configuração local pendente de homologação superior não vale sozinha", () => {
    const evaluation = evaluateConfigurationOverride({
      policyScope: demonstrationPolicyScopes[2]!,
      allowedOverrides: demonstrationAllowedOverrides,
      delegations: demonstrationConfigurationDelegations,
      agentCapacityDefinitionIds: [LEADERSHIP_CAPACITIES.configureUnitParameter],
      scopeEntities: unitScope,
      parameterDefinitionId: "parametro-turno-de-atendimento",
      proposedValue: "manha",
      isoDate: "2027-05-10",
    });
    expect(evaluation.outcome).toBe(OVERRIDE_OUTCOME.requiresSuperiorHomologation);
  });

  it("restrição sem executor registrado deixa o override inconclusivo", () => {
    const registry = createOverrideConstraintRegistry();
    registry.delete("valor-numerico-dentro-do-intervalo");
    const evaluation = evaluateConfigurationOverride({
      policyScope: demonstrationPolicyScopes[1]!,
      allowedOverrides: demonstrationAllowedOverrides,
      delegations: demonstrationConfigurationDelegations,
      agentCapacityDefinitionIds: [LEADERSHIP_CAPACITIES.configureUnitParameter],
      scopeEntities: unitScope,
      parameterDefinitionId: "parametro-dias-da-janela",
      proposedValue: 20,
      isoDate: "2027-05-10",
      constraintRegistry: registry,
    });
    expect(evaluation.outcome).toBe(OVERRIDE_OUTCOME.inconclusive);
  });

  it("sem capacidade delegada vigente o override é bloqueado", () => {
    const evaluation = evaluateConfigurationOverride({
      policyScope: demonstrationPolicyScopes[1]!,
      allowedOverrides: demonstrationAllowedOverrides,
      delegations: demonstrationConfigurationDelegations,
      agentCapacityDefinitionIds: [LEADERSHIP_CAPACITIES.consultInstitutionalState],
      scopeEntities: unitScope,
      parameterDefinitionId: "parametro-dias-da-janela",
      proposedValue: 20,
      isoDate: "2027-05-10",
    });
    expect(evaluation.outcome).toBe(OVERRIDE_OUTCOME.blocked);
  });
});

describe("13I.12 — retificação encadeada e versão vigente derivada", () => {
  const first: InstitutionalDecisionRecord = decideInstitutionalProcess({
    process: exceptionalProcess,
    typeDefinition: exceptionalEnrollmentDecisionType,
    grants: demonstrationCompetenceGrants,
    agentId: "agente-direcao-a",
    chosenAlternativeDefinitionId: "alternativa-autorizar-excepcionalmente",
    justificationSnapshot: "Fundamentação inicial demonstrativa.",
    effectiveDate: "2027-04-20",
    recordedAt: "2027-04-20T12:00:00.000Z",
    decisionRecordId: "decisao-retif-001",
  }).decision!;

  it("a decisão anterior permanece íntegra e referenciada", () => {
    const corrected = rectifyDecision({
      previous: first,
      decisionRecordId: "decisao-retif-002",
      chosenAlternativeDefinitionId: "alternativa-indeferir",
      correctionReasonDefinitionId: "motivo-erro-material",
      correctionNote: "Retificação demonstrativa.",
      effectiveDate: "2027-04-25",
      recordedAt: "2027-04-25T12:00:00.000Z",
      agentId: "agente-direcao-a",
      exercisedGrantId: "concessao-002",
    });
    expect(corrected.supersedesDecisionRecordId).toBe("decisao-retif-001");
    expect(first.chosenAlternativeDefinitionId).toBe(
      "alternativa-autorizar-excepcionalmente",
    );
    // O ato anterior não é reaproveitado pela nova versão.
    expect(corrected.act).toBeUndefined();
    expect(currentDecisionRecord([first, corrected], first.decisionProcessId)).toBe(
      corrected,
    );
  });
});

describe("13I.13 — estado do processo é projeção, nunca campo persistido", () => {
  it("processo sem decisão aguarda decisão; com decisão fica decidido", () => {
    const decision = decideInstitutionalProcess({
      process: exceptionalProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      chosenAlternativeDefinitionId: "alternativa-autorizar-excepcionalmente",
      justificationSnapshot: "Fundamentação demonstrativa.",
      effectiveDate: "2027-04-20",
      recordedAt: "2027-04-20T12:00:00.000Z",
      decisionRecordId: "decisao-estado-001",
    }).decision!;
    expect(
      projectDecisionProcessState({ process: exceptionalProcess, decisions: [] })
        .stateDefinitionId,
    ).toBe(LEADERSHIP_PROCESS_STATES.awaitingDecision);
    expect(
      projectDecisionProcessState({
        process: exceptionalProcess,
        decisions: [decision],
      }).stateDefinitionId,
    ).toBe(LEADERSHIP_PROCESS_STATES.decided);
  });
});

describe("13I.14 — filas são derivadas, sem inferência indevida", () => {
  const projection = buildLeadershipWorkspaceProjection();

  it("a fila de decisões traz apenas processos aguardando decisão", () => {
    const items = leadershipQueueItems(
      projection,
      "fila-processos-aguardando-decisao-demo",
    );
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.processStateDefinitionId).toBe(
        LEADERSHIP_PROCESS_STATES.awaitingDecision,
      );
    }
  });

  it("a fila de exceções usa o motivo de escalonamento declarado", () => {
    const items = leadershipQueueItems(
      projection,
      "fila-excecoes-alem-da-secretaria-demo",
    );
    expect(items.map((item) => item.source.entityId)).toEqual(["processo-decisao-001"]);
  });

  it("nenhum item projetado fora do escopo institucional do agente", () => {
    const outOfScope = buildLeadershipWorkspaceProjection({
      context: createLeadershipAccessContext({ institutionalScopeIds: ["demo-009"] }),
    });
    expect(outOfScope.authorizedItems).toHaveLength(0);
  });
});

describe("13I.15 — confidencialidade da Orientação preservada", () => {
  it("a Direção vê a providência solicitada, não o conteúdo confidencial", () => {
    const projection = buildLeadershipWorkspaceProjection();
    const referral = projection.authorizedItems.find(
      (item) =>
        item.processTypeDefinitionId === LEADERSHIP_PROCESS_TYPES.guidanceReferral,
    );
    expect(referral).toBeDefined();
    expect(referral?.authorizedPayload["providenciaSolicitada"]).toContain(
      "providência administrativa",
    );
    expect(referral?.authorizedPayload["conteudoConfidencial"]).toBeUndefined();
    expect(JSON.stringify(projection.authorizedItems)).not.toContain(
      "Conteúdo pedagógico confidencial do acompanhamento",
    );
  });

  it("com a capacidade específica o conteúdo restrito é liberado", () => {
    const projection = buildLeadershipWorkspaceProjection({
      context: createLeadershipAccessContext({
        capacityDefinitionIds: [
          LEADERSHIP_CAPACITIES.consultInstitutionalState,
          LEADERSHIP_CAPACITIES.readGuidanceRestrictedContent,
        ],
      }),
    });
    const referral = projection.authorizedItems.find(
      (item) =>
        item.processTypeDefinitionId === LEADERSHIP_PROCESS_TYPES.guidanceReferral,
    );
    expect(referral?.authorizedPayload["conteudoConfidencial"]).toContain(
      "Conteúdo pedagógico confidencial",
    );
  });
});

describe("13I.16 — conformidade da unidade sem indicador estatístico", () => {
  const projection = buildLeadershipWorkspaceProjection();
  const statements = projectLeadershipUnitCompliance({ projection });

  it("conta objetos concretos e distingue inconclusivo de impedimento", () => {
    const impediments = statements.find(
      (statement) => statement.statementKey === "conformidade-turmas-com-impedimento",
    );
    const inconclusive = statements.find(
      (statement) =>
        statement.statementKey === "conformidade-turmas-com-fechamento-inconclusivo",
    );
    expect(impediments?.objectCount).toBe(2);
    expect(inconclusive?.objectCount).toBe(1);
    expect(impediments?.objectReferences.every((reference) => reference.entityId)).toBe(
      true,
    );
  });

  it("nenhuma taxa, média ou percentual é publicada", () => {
    const serialized = JSON.stringify(statements);
    for (const forbidden = ["taxa", "percentual", "média", "indicador", "ranking"];;) {
      expect(forbidden.some((term) => serialized.includes(term))).toBe(false);
      break;
    }
  });

  it("todas as pendências de encerramento demonstrativas são desta unidade", () => {
    expect(
      demonstrationClosingImpediments.every(
        (impediment) => impediment.unitId === "demo-001",
      ),
    ).toBe(true);
  });
});

describe("13I.17 — navegação e histórico são projeções, não ledgers novos", () => {
  const projection = buildLeadershipWorkspaceProjection();

  it("a árvore de navegação aponta para o objeto real", () => {
    const tree = projectLeadershipNavigationTree({
      projection,
      unitLabelSnapshot: "Unidade demonstrativa demo-001",
    });
    const classesNode = tree.children.find((child) => child.nodeKey === "no-turmas");
    expect(classesNode?.children.length).toBeGreaterThan(0);
    expect(classesNode?.children[0]?.deepLinkParams?.["turmaId"]).toBeDefined();
  });

  it("a linha do tempo deriva das decisões e marca retificação", () => {
    const decision = decideInstitutionalProcess({
      process: exceptionalProcess,
      typeDefinition: exceptionalEnrollmentDecisionType,
      grants: demonstrationCompetenceGrants,
      agentId: "agente-direcao-a",
      chosenAlternativeDefinitionId: "alternativa-autorizar-excepcionalmente",
      justificationSnapshot: "Fundamentação demonstrativa.",
      effectiveDate: "2027-04-20",
      recordedAt: "2027-04-20T12:00:00.000Z",
      decisionRecordId: "decisao-timeline-001",
    }).decision!;
    const corrected = rectifyDecision({
      previous: decision,
      decisionRecordId: "decisao-timeline-002",
      chosenAlternativeDefinitionId: "alternativa-indeferir",
      correctionReasonDefinitionId: "motivo-erro-material",
      effectiveDate: "2027-04-25",
      recordedAt: "2027-04-25T12:00:00.000Z",
      agentId: "agente-direcao-a",
      exercisedGrantId: "concessao-002",
    });
    const timeline = projectLeadershipInstitutionalTimeline({
      decisions: [decision, corrected],
      projection,
    });
    expect(timeline[0]?.entityId).toBe("decisao-timeline-001");
    expect(
      timeline.find((entry) => entry.entityId === "decisao-timeline-002")
        ?.supersedesEntityId,
    ).toBe("decisao-timeline-001");
  });
});

describe("13I.18 — segunda perspectiva fictícia vê o mesmo domínio diferente", () => {
  it("agente sem capacidade de decidir não recebe ação admissível", () => {
    const projection = buildLeadershipWorkspaceProjection({
      context: createLeadershipAccessContext({
        actorId: "agente-direcao-b",
        capacityDefinitionIds: [LEADERSHIP_CAPACITIES.consultInstitutionalState],
      }),
    });
    const authorizedActions = projection.authorizedItems.flatMap((item) => item.actions);
    expect(
      authorizedActions.some((action) => action.admissibility === "admissivel"),
    ).toBe(false);
  });

  it("a ficha do estudante declara ausência de dado sem afirmar fato positivo", () => {
    const result = buildLeadershipStudentProfile({
      subjectEntityId: "alu-001",
      context: createLeadershipAccessContext({
        actorId: "agente-direcao-b",
        capacityDefinitionIds: [LEADERSHIP_CAPACITIES.consultInstitutionalState],
      }),
    });
    const serialized = JSON.stringify(result.sections);
    expect(serialized).toContain("Ausência");
  });
});
