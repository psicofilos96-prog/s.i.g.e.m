/**
 * Rodada 6B.3.2 — Auditoria das travas da apresentação da Orientação.
 *
 * O que estes testes protegem: a tradução não pode inventar prioridade, estado,
 * verbo, rótulo, responsável, autorização nem leitura positiva de ausência.
 */
import { describe, expect, it } from "vitest";
import {
  WORKSPACE_ADMISSIBILITY,
  WORKSPACE_AUTHORIZATION,
  type OperationalQueueItem,
  type WorkspaceActionDescriptor,
} from "@/features/workspace/workspace-types";
import {
  NO_ACTIVE_FOLLOW_UP_NOTE,
  buildGuidanceTimeline,
  projectAuthorizedContacts,
  resolveConfiguredLabel,
  resolveGuidanceAction,
  resolveGuidanceStateLine,
  resolveGuidanceTimingLine,
  resolveObservedFactLines,
  resolvePactView,
  resolveSignalOccurrenceView,
} from "./guidance-presentation";
import {
  GUIDANCE_RESPONSIBILITY_CAPACITY,
  demonstrationCommunications,
  demonstrationInterventions,
  demonstrationPlanVersions,
  demonstrationReferrals,
  demonstrationResponsibilityAssignments,
  demonstrationCases,
} from "./guidance-fixtures";
import { buildDemonstrationSignalOccurrences } from "./guidance-signals-demo";
import { casesForSubject } from "./guidance-cases";
import type { GuidanceFact } from "./guidance-types";

function action(overrides: Partial<WorkspaceActionDescriptor> = {}): WorkspaceActionDescriptor {
  return {
    actionKey: "acao-1",
    operationDefinitionId: "operacao-configurada-x",
    labelSnapshot: "Rótulo vindo da configuração",
    executingDomainId: "dominio-13h-acompanhamento-pedagogico",
    processAdmissibility: WORKSPACE_ADMISSIBILITY.admissible,
    actorAuthorization: WORKSPACE_AUTHORIZATION.authorized,
    requiredCapacityDefinitionIds: ["cap-x"],
    missingCapacityDefinitionIds: [],
    impedimentMessages: [],
    explanation: "Diagnóstico do motor.",
    ...overrides,
  };
}

function queueItem(overrides: Partial<OperationalQueueItem> = {}): OperationalQueueItem {
  return {
    queueItemKey: "item-1",
    queueDefinitionId: "fila-1",
    source: {
      sourceTypeDefinitionId: "fonte-x",
      entityId: "ent-1",
      entityVersion: 1,
      sourceProjectionSchemaVersion: 1,
    },
    producedByDomainId: "dominio-13h-acompanhamento-pedagogico",
    processTypeDefinitionId: "processo-x",
    processStateDefinitionId: "estado-x",
    titleSnapshot: "Título declarado pela fonte",
    subjectReferences: [],
    effectiveDate: "2027-03-01",
    recordedAt: "2027-03-01T10:00:00.000Z",
    actions: [],
    requirementDiagnostics: [],
    authorizedPayload: {},
    redactedFieldPaths: [],
    ...overrides,
  };
}

describe("ações da Orientação vêm da configuração, nunca do componente", () => {
  it("usa o rótulo declarado e preserva o diagnóstico na proveniência", () => {
    const view = resolveGuidanceAction(action());
    expect(view.label).toBe("Rótulo vindo da configuração");
    expect(view.available).toBe(true);
    expect(view.provenance.map((entry) => entry.detail)).toContain("Diagnóstico do motor.");
  });

  it("falha fechada quando falta capacidade, explicando sem conceder autoridade", () => {
    const view = resolveGuidanceAction(
      action({
        actorAuthorization: WORKSPACE_AUTHORIZATION.notAuthorized,
        missingCapacityDefinitionIds: ["cap-x"],
      }),
    );
    expect(view.available).toBe(false);
    expect(view.unavailableReason).toBeTruthy();
  });

  it("não inventa verbo: nenhuma ação é conhecida por nome pela apresentação", () => {
    const view = resolveGuidanceAction(action({ labelSnapshot: "Verbo inédito da configuração" }));
    expect(view.label).toBe("Verbo inédito da configuração");
  });
});

describe("situação e prazo não criam prioridade nem classificação", () => {
  it("não enumera estados: devolve frase serena quando nada pode ser especializado", () => {
    expect(resolveGuidanceStateLine(queueItem())).toBe("Em acompanhamento.");
  });

  it("encerrar não afirma resolver", () => {
    const line = resolveGuidanceStateLine(
      queueItem({ concludedAt: "2027-04-01T00:00:00.000Z" }),
    );
    expect(line).toContain("01/04/2027");
    expect(line).toContain("não significa");
  });

  it("só apresenta prazo quando ele foi declarado pela fonte", () => {
    expect(resolveGuidanceTimingLine(queueItem())).toBeNull();
    expect(
      resolveGuidanceTimingLine(
        queueItem({
          deadline: { dueDate: "2027-04-20", labelSnapshot: "Retorno combinado no plano" },
        }),
      ),
    ).toContain("20/04/2027");
  });
});

describe("o sinal é acontecimento do percurso, não rótulo da pessoa", () => {
  it("apresenta o fato material e a data, com a definição só na proveniência", () => {
    const occurrence = buildDemonstrationSignalOccurrences()[0];
    expect(occurrence).toBeDefined();
    const view = resolveSignalOccurrenceView({
      occurrence: occurrence!,
      signalLabels: { [occurrence!.signalDefinitionId]: "Presença abaixo do parâmetro" },
    });
    expect(view.observedOnLine).toMatch(/^Registrado em \d{2}\/\d{2}\/\d{4}$/);
    expect(view.observedFacts.length).toBeGreaterThan(0);
    expect(view.provenance.some((entry) => entry.detail.includes("versão"))).toBe(true);
  });

  it("ausência de dado nunca vira zero nem condição atendida", () => {
    const facts: readonly GuidanceFact[] = [
      {
        factKey: "frequencia-apurada",
        value: null,
        unavailableReason: "o fechamento oficial de frequência ainda não foi publicado",
        labelSnapshot: "Frequência apurada",
      },
    ];
    const [line] = resolveObservedFactLines(facts);
    expect(line?.absence).toBe(true);
    expect(line?.text).toContain("ainda não foi publicado");
    expect(line?.text).not.toContain("0");
  });

  it("fato sem rótulo declarado não é traduzido pela interface", () => {
    const [line] = resolveObservedFactLines([
      { factKey: "fato-sem-rotulo", value: 3 } as GuidanceFact,
    ]);
    expect(line?.text).not.toContain("fato-sem-rotulo");
    expect(line?.provenance.some((entry) => entry.detail === "fato-sem-rotulo")).toBe(true);
  });

  it("identificador sem rótulo configurado não recebe frase inventada", () => {
    expect(resolveConfiguredLabel("def-desconhecida", {})).toBeNull();
  });
});

describe("combinados admitem ausência e preservam versões", () => {
  it("devolve nulo quando não há plano registrado", () => {
    expect(resolvePactView({ planVersion: null })).toBeNull();
  });

  it("apresenta objetivos, retorno combinado e cadeia de versões", () => {
    const version = demonstrationPlanVersions.find(
      (candidate) => candidate.planVersionId === "plano-versao-002",
    );
    const view = resolvePactView({ planVersion: version ?? null });
    expect(view?.items[0]?.objective).toContain("responsável");
    expect(view?.items[0]?.returnLine).toContain("20/04/2027");
    expect(
      view?.provenance.some((entry) => entry.detail.includes("plano-versao-001")),
    ).toBe(true);
  });
});

describe("contato exige responsabilidade vigente com a capacidade exigida", () => {
  it("autoriza somente com atribuição vigente na data e para a finalidade", () => {
    const [contact] = projectAuthorizedContacts({
      studentId: "alu-001",
      assignments: demonstrationResponsibilityAssignments,
      requiredCapacityDefinitionId: GUIDANCE_RESPONSIBILITY_CAPACITY,
      isoDate: "2027-04-10",
      purposeLabel: "falar sobre este acompanhamento",
    });
    expect(contact?.authorized).toBe(true);
    expect(contact?.validityLine).toContain("01/01/2027");
  });

  it("não autoriza antes do início da vigência", () => {
    const [contact] = projectAuthorizedContacts({
      studentId: "alu-001",
      assignments: demonstrationResponsibilityAssignments,
      requiredCapacityDefinitionId: GUIDANCE_RESPONSIBILITY_CAPACITY,
      isoDate: "2026-12-31",
      purposeLabel: "falar sobre este acompanhamento",
    });
    expect(contact?.authorized).toBe(false);
  });

  it("não autoriza quando a capacidade exigida é outra", () => {
    const [contact] = projectAuthorizedContacts({
      studentId: "alu-001",
      assignments: demonstrationResponsibilityAssignments,
      requiredCapacityDefinitionId: "cap-inedita-nao-declarada",
      isoDate: "2027-04-10",
      purposeLabel: "falar sobre este acompanhamento",
    });
    expect(contact?.authorized).toBe(false);
  });

  it("não inventa contato para estudante sem atribuição registrada", () => {
    expect(
      projectAuthorizedContacts({
        studentId: "alu-002",
        assignments: demonstrationResponsibilityAssignments,
        requiredCapacityDefinitionId: GUIDANCE_RESPONSIBILITY_CAPACITY,
        isoDate: "2027-04-10",
        purposeLabel: "falar sobre este acompanhamento",
      }),
    ).toHaveLength(0);
  });
});

describe("linha do tempo é composição de fatos canônicos", () => {
  const timeline = buildGuidanceTimeline({
    caseId: "caso-demo-001",
    interventions: demonstrationInterventions,
    communications: demonstrationCommunications,
    referrals: demonstrationReferrals,
    mayReadRestrictedContent: false,
  });

  it("ordena do mais recente para o mais antigo e referencia a origem", () => {
    expect(timeline.length).toBeGreaterThan(1);
    const dates = timeline.map((entry) => entry.isoDate);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const entry of timeline) {
      expect(entry.provenance.some((detail) => detail.term.includes("identificador"))).toBe(true);
    }
  });

  it("não transcreve conteúdo restrito sem a capacidade declarada", () => {
    const withoutCapacity = timeline.filter((entry) => entry.key.startsWith("interv::"));
    for (const entry of withoutCapacity) {
      expect(entry.detail).toBeNull();
    }
  });

  it("não mistura registros de outro acompanhamento", () => {
    expect(
      buildGuidanceTimeline({
        caseId: "caso-inexistente",
        interventions: demonstrationInterventions,
        communications: demonstrationCommunications,
        referrals: demonstrationReferrals,
        mayReadRestrictedContent: true,
      }),
    ).toHaveLength(0);
  });
});

describe("estudante sem sinal e sem acompanhamento ativo", () => {
  it("nenhum caso é encontrado e a ausência não afirma que está tudo bem", () => {
    expect(casesForSubject(demonstrationCases, "alu-sem-registro-demo")).toHaveLength(0);
    expect(NO_ACTIVE_FOLLOW_UP_NOTE).toContain("não afirma que está tudo bem");
    expect(NO_ACTIVE_FOLLOW_UP_NOTE).not.toMatch(/sem problema|regular|tudo certo/i);
  });
});
