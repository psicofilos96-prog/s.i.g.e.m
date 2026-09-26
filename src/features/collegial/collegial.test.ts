/**
 * Etapa 12J — conformidade dos colegiados.
 *
 * Todas as configurações usadas aqui são fictícias. Nenhum teste homologa regra
 * nem atribui competência real a colegiado algum.
 */
import { describe, expect, it } from "vitest";
import type { DeliberationBody } from "@/features/assessment/academic-standing-types";
import { collegialAnalyticRows } from "./collegial-analytics";
import {
  demonstrationCollegialBodyA,
  demonstrationCollegialBodyB,
  collegialDemonstrationActor,
} from "./collegial-fixtures";
import { dossierDivergences, quorumEvaluation } from "./collegial-governance";
import { createCollegialStore } from "./collegial-store";
import type {
  CollegialActor,
  DeliberationDossier,
  SessionAgendaItem,
  SessionParticipant,
} from "./collegial-types";

const conductor: CollegialActor = collegialDemonstrationActor("perfil-colegiado-conducao");
const viewer: CollegialActor = collegialDemonstrationActor("perfil-colegiado-consulta");

/** Órgão fictício da regra de situação: a competência mora na regra, não no colegiado. */
const fictionalBody: DeliberationBody = {
  id: "col-demo-a",
  label: "Órgão fictício de teste",
  competences: [
    {
      id: "comp-ficticia-1",
      label: "Competência fictícia de teste",
      allowedStandingIds: ["sit-ficticia-x"],
    },
  ],
};

const dossier = (version: number): DeliberationDossier => ({
  referenceSnapshotAt: "2027-12-10T12:00:00.000Z",
  sources: [
    { kind: "fechamento-de-periodo", id: "fec-ficticio-1", version, label: "Fechamento fictício" },
  ],
  facts: [
    {
      factId: "fato-ficticio-rendimento",
      scopeKey: "ciclo-ficticio|aluno-ficticio",
      label: "Rendimento fictício do ciclo",
      value: 42,
      provenance: {
        sources: [{ kind: "fechamento-de-periodo", id: "fec-ficticio-1" }],
        algorithm: "demonstracao-ficticia",
        materializedAt: "2027-12-10T12:00:00.000Z",
      },
    },
  ],
  computed: {
    standingId: "sit-ficticia-y",
    operationalState: "aguardando-deliberacao",
    ruleSetId: "reg-ficticia",
    ruleSetVersion: 3,
  },
});

const participants = (): SessionParticipant[] => [
  { id: "p1", name: "Participante 1", roleId: "papel-demo-conducao", present: true },
  { id: "p2", name: "Participante 2", roleId: "papel-demo-registro", present: true },
];

const agendaItem = (overrides: Partial<SessionAgendaItem> = {}): SessionAgendaItem => ({
  id: "item-1",
  order: 1,
  title: "Caso fictício",
  subject: { kind: "percurso-de-estudante", studentId: "aluno-ficticio" },
  origin: {
    kind: "encaminhamento-por-regra",
    ruleSetId: "reg-ficticia",
    ruleSetVersion: 3,
    bodyId: "col-demo-a",
    competenceId: "comp-ficticia-1",
  },
  dossier: dossier(1),
  ...overrides,
});

function storeWithSession(bodyId: string, natureId: string) {
  const store = createCollegialStore({
    configurations: [demonstrationCollegialBodyA, demonstrationCollegialBodyB],
  });
  const opened = store.openSession({
    actor: conductor,
    session: {
      id: `ses-${bodyId}`,
      bodyId,
      bodyConfigurationVersion: 1,
      natureId,
      scope: { classId: "turma-ficticia", cycleId: "ciclo-ficticio" },
      scheduledFor: "2027-12-10T18:00:00.000Z",
      participants: [],
      agenda: [],
    },
    now: "2027-12-01T12:00:00.000Z",
  });
  return { store, opened };
}

describe("12J — sessão e pauta", () => {
  it("recusa natureza de sessão não cadastrada, sem enumerar naturezas no motor", () => {
    const { store } = storeWithSession("col-demo-a", "nat-demo-a-1");
    const result = store.openSession({
      actor: conductor,
      session: {
        id: "ses-x",
        bodyId: "col-demo-a",
        bodyConfigurationVersion: 1,
        natureId: "nat-inexistente",
        scope: {},
        scheduledFor: "2027-12-10T18:00:00.000Z",
        participants: [],
        agenda: [],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons[0]).toContain("não está cadastrada");
  });

  it("aceita pauta institucional sem vínculo com estudante", () => {
    const { store } = storeWithSession("col-demo-b", "nat-demo-b-1");
    const result = store.addAgendaItem({
      actor: conductor,
      sessionId: "ses-col-demo-b",
      item: {
        id: "item-inst",
        order: 1,
        title: "Assunto institucional fictício",
        subject: { kind: "assunto-institucional" },
        origin: { kind: "pauta-institucional" },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.agenda[0]?.subject.studentId).toBeUndefined();
  });

  it("bloqueia provocação formal quando a configuração não declara política", () => {
    const { store } = storeWithSession("col-demo-b", "nat-demo-b-1");
    const result = store.addAgendaItem({
      actor: conductor,
      sessionId: "ses-col-demo-b",
      item: agendaItem({
        id: "item-prov",
        origin: {
          kind: "provocacao-formal",
          policyId: "pro-demo-a",
          reasonId: "mot-demo-a-2",
          requestedBy: { actorId: conductor.id, actorName: conductor.name, profileLabel: "x", at: "2027-12-01T12:00:00.000Z" },
          justification: "Justificativa fictícia",
        },
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons[0]).toContain("não declara política de provocação formal");
  });

  it("exige documentação quando o motivo configurado a exigir", () => {
    const { store } = storeWithSession("col-demo-a", "nat-demo-a-1");
    const result = store.addAgendaItem({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      item: agendaItem({
        id: "item-prov",
        origin: {
          kind: "provocacao-formal",
          policyId: "pro-demo-a",
          reasonId: "mot-demo-a-1",
          requestedBy: { actorId: conductor.id, actorName: conductor.name, profileLabel: "x", at: "2027-12-01T12:00:00.000Z" },
          justification: "Justificativa fictícia",
        },
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toContain("documentação de referência");
  });
});

describe("12J — competência e camadas do resultado", () => {
  it("recusa situação fora das competências declaradas pela regra", () => {
    const { store } = storeWithSession("col-demo-a", "nat-demo-a-1");
    store.addAgendaItem({ actor: conductor, sessionId: "ses-col-demo-a", item: agendaItem() });
    const result = store.registerDeliberation({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      body: fictionalBody,
      deliberation: {
        agendaItemId: "item-1",
        bodyId: "col-demo-a",
        competenceId: "comp-ficticia-1",
        competenceLabel: "Competência fictícia de teste",
        studentId: "aluno-ficticio",
        cycleId: "ciclo-ficticio",
        decisionMethodId: "dec-demo-a",
        votes: [
          { participantName: "Participante 1", optionId: "voto-demo-favoravel" },
          { participantName: "Participante 2", optionId: "voto-demo-favoravel" },
        ],
        decision: {
          outcomeId: "res-ficticio",
          outcomeLabel: "Resultado fictício",
          standingId: "sit-nao-autorizada",
        },
        rationale: "Fundamentação fictícia.",
        dossier: dossier(1),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toContain("não autoriza produzir a situação");
  });

  it("recusa situação quando nenhum órgão da regra homologada é informado", () => {
    const { store } = storeWithSession("col-demo-a", "nat-demo-a-1");
    store.addAgendaItem({ actor: conductor, sessionId: "ses-col-demo-a", item: agendaItem() });
    const result = store.registerDeliberation({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      deliberation: {
        agendaItemId: "item-1",
        bodyId: "col-demo-a",
        competenceId: "comp-ficticia-1",
        competenceLabel: "Competência fictícia de teste",
        decisionMethodId: "dec-demo-a",
        votes: [{ participantName: "Participante 1", optionId: "voto-demo-favoravel" }],
        decision: {
          outcomeId: "res-ficticio",
          outcomeLabel: "Resultado fictício",
          standingId: "sit-ficticia-x",
        },
        rationale: "Fundamentação fictícia.",
        dossier: dossier(1),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toContain("não lhe confere competência");
  });

  it("preserva o resultado matemático ao registrar a situação deliberada", () => {
    const { store } = storeWithSession("col-demo-a", "nat-demo-a-1");
    store.addAgendaItem({ actor: conductor, sessionId: "ses-col-demo-a", item: agendaItem() });
    const result = store.registerDeliberation({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      body: fictionalBody,
      deliberation: {
        agendaItemId: "item-1",
        bodyId: "col-demo-a",
        competenceId: "comp-ficticia-1",
        competenceLabel: "Competência fictícia de teste",
        studentId: "aluno-ficticio",
        cycleId: "ciclo-ficticio",
        decisionMethodId: "dec-demo-a",
        votes: [
          { participantName: "Participante 1", optionId: "voto-demo-favoravel" },
          { participantName: "Participante 2", optionId: "voto-demo-favoravel" },
        ],
        decision: {
          outcomeId: "res-ficticio",
          outcomeLabel: "Resultado fictício",
          standingId: "sit-ficticia-x",
        },
        rationale: "Fundamentação fictícia registrada por extenso.",
        dossier: dossier(1),
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Camada 1 intacta, camada 3 registrada ao lado.
    expect(result.value.dossier.computed?.standingId).toBe("sit-ficticia-y");
    expect(result.value.dossier.facts[0]?.value).toBe(42);
    expect(result.value.decision.standingId).toBe("sit-ficticia-x");
  });

  it("exige fundamentação por extenso", () => {
    const { store } = storeWithSession("col-demo-b", "nat-demo-b-1");
    store.addAgendaItem({ actor: conductor, sessionId: "ses-col-demo-b", item: agendaItem() });
    const result = store.registerDeliberation({
      actor: conductor,
      sessionId: "ses-col-demo-b",
      deliberation: {
        agendaItemId: "item-1",
        bodyId: "col-demo-b",
        competenceId: "comp-ficticia-1",
        competenceLabel: "Competência fictícia",
        decision: { outcomeId: "res-ficticio", outcomeLabel: "Encaminhamento pedagógico fictício" },
        rationale: "   ",
        dossier: dossier(1),
      },
    });
    expect(result.ok).toBe(false);
  });
});

describe("12J — formas de decisão configuráveis", () => {
  it("não inventa votação quando a política não registra votos", () => {
    const { store } = storeWithSession("col-demo-b", "nat-demo-b-1");
    store.addAgendaItem({ actor: conductor, sessionId: "ses-col-demo-b", item: agendaItem() });
    const result = store.registerDeliberation({
      actor: conductor,
      sessionId: "ses-col-demo-b",
      deliberation: {
        agendaItemId: "item-1",
        bodyId: "col-demo-b",
        competenceId: "comp-ficticia-1",
        competenceLabel: "Competência fictícia",
        votes: [{ participantName: "Participante 1", optionId: "voto-demo-favoravel" }],
        decision: { outcomeId: "res-ficticio", outcomeLabel: "Declaração fictícia" },
        rationale: "Fundamentação fictícia.",
        dossier: dossier(1),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toContain("não registra votos");
  });

  it("aplica a apuração declarada pela configuração, sem maioria embutida", () => {
    const { store } = storeWithSession("col-demo-a", "nat-demo-a-1");
    store.addAgendaItem({ actor: conductor, sessionId: "ses-col-demo-a", item: agendaItem() });
    const result = store.registerDeliberation({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      body: fictionalBody,
      deliberation: {
        agendaItemId: "item-1",
        bodyId: "col-demo-a",
        competenceId: "comp-ficticia-1",
        competenceLabel: "Competência fictícia",
        decisionMethodId: "dec-demo-a",
        votes: [
          { participantName: "Participante 1", optionId: "voto-demo-favoravel" },
          { participantName: "Participante 2", optionId: "voto-demo-contrario" },
          { participantName: "Participante 3", optionId: "voto-demo-abstencao" },
        ],
        decision: { outcomeId: "res-ficticio", outcomeLabel: "Resultado fictício" },
        rationale: "Fundamentação fictícia.",
        dossier: dossier(1),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toContain("aprovação declarada");
  });
});

describe("12J — quórum, composição e assinaturas só quando configurados", () => {
  it("não exige quórum quando a configuração não o declara", () => {
    const evaluation = quorumEvaluation(demonstrationCollegialBodyB, []);
    expect(evaluation.satisfied).toBeNull();
    expect(evaluation.reason).toContain("não declara política de quórum");
  });

  it("encerra ata de colegiado sem exigências, sem papéis nem assinaturas", () => {
    const { store } = storeWithSession("col-demo-b", "nat-demo-b-1");
    store.setParticipants({
      actor: conductor,
      sessionId: "ses-col-demo-b",
      participants: [{ name: "Participante único", present: true }],
    });
    const result = store.closeMinute({
      actor: conductor,
      sessionId: "ses-col-demo-b",
      now: "2027-12-10T20:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.quorum.satisfied).toBeNull();
  });

  it("bloqueia o encerramento quando a configuração exige papel e assinatura", () => {
    const { store } = storeWithSession("col-demo-a", "nat-demo-a-1");
    store.setParticipants({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      participants: [{ name: "Participante 1", present: true }],
    });
    const result = store.closeMinute({ actor: conductor, sessionId: "ses-col-demo-a" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.join(" ")).toContain("papel");
      expect(result.reasons.join(" ")).toContain("aceite");
    }
  });

  it("recusa condução por perfil sem a capacidade declarada", () => {
    const { store } = storeWithSession("col-demo-a", "nat-demo-a-1");
    const result = store.setParticipants({
      actor: viewer,
      sessionId: "ses-col-demo-a",
      participants: participants(),
    });
    expect(result.ok).toBe(false);
  });
});

describe("12J — ata imutável e retificação encadeada", () => {
  const closeFullMinute = () => {
    const { store } = storeWithSession("col-demo-a", "nat-demo-a-1");
    store.setParticipants({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      participants: participants(),
    });
    store.addAgendaItem({ actor: conductor, sessionId: "ses-col-demo-a", item: agendaItem() });
    const closed = store.closeMinute({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      signatures: [
        { participantId: "p1", name: "Participante 1", roleId: "papel-demo-conducao", kind: "aceite-demonstrativo", acceptedAt: "2027-12-10T20:00:00.000Z" },
        { participantId: "p2", name: "Participante 2", roleId: "papel-demo-registro", kind: "aceite-demonstrativo", acceptedAt: "2027-12-10T20:00:00.000Z" },
      ],
      now: "2027-12-10T20:00:00.000Z",
    });
    return { store, closed };
  };

  it("encerra a ata e impede nova deliberação ou nova pauta na mesma sessão", () => {
    const { store, closed } = closeFullMinute();
    expect(closed.ok).toBe(true);
    const again = store.addAgendaItem({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      item: agendaItem({ id: "item-2" }),
    });
    expect(again.ok).toBe(false);
    const second = store.closeMinute({ actor: conductor, sessionId: "ses-col-demo-a" });
    expect(second.ok).toBe(false);
  });

  it("retificação gera nova versão encadeada e preserva a anterior", () => {
    const { store } = closeFullMinute();
    const rectified = store.rectifyMinute({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      justification: "Correção fictícia de manifestação omitida.",
      changes: {
        statements: [
          { id: "man-1", at: "2027-12-11T10:00:00.000Z", authorName: "Participante 1", text: "Manifestação fictícia." },
        ],
      },
      now: "2027-12-11T10:00:00.000Z",
    });
    expect(rectified.ok).toBe(true);
    const chain = store.minuteChain("ses-col-demo-a");
    expect(chain.map((minute) => minute.version)).toEqual([1, 2]);
    expect(chain[0]?.statements).toEqual([]);
    expect(chain[1]?.precedingMinuteId).toBe(chain[0]?.id);
    expect(chain[1]?.rectification?.supersedesMinuteId).toBe(chain[0]?.id);
  });

  it("retificação sem justificativa é recusada", () => {
    const { store } = closeFullMinute();
    const result = store.rectifyMinute({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      justification: "  ",
    });
    expect(result.ok).toBe(false);
  });
});

describe("12J — dossiê analisado permanece preservado", () => {
  it("relata retificação posterior das fontes sem alterar o que foi analisado", () => {
    const analysed = dossier(1);
    const divergences = dossierDivergences(analysed, [
      { kind: "fechamento-de-periodo", id: "fec-ficticio-1", version: 2 },
    ]);
    expect(divergences).toHaveLength(1);
    expect(divergences[0]?.message).toContain("retificada depois da sessão");
    expect(analysed.sources[0]?.version).toBe(1);
  });
});

describe("12J — percurso sem situação promocional não é encaminhado", () => {
  it("nenhum item de pauta emerge quando a regra não encaminha a colegiado", () => {
    // Percurso qualitativo fictício (por exemplo, um percurso descritivo): a
    // configuração simplesmente não produz encaminhamento. Não existe
    // condicional por etapa ou modalidade em lugar algum do motor.
    const { store } = storeWithSession("col-demo-b", "nat-demo-b-1");
    const session = store.session("ses-col-demo-b");
    expect(session?.agenda).toEqual([]);
    const rows = collegialAnalyticRows({
      sessions: store.sessions(),
      deliberations: store.deliberationsOf("ses-col-demo-b"),
      minutes: store.minutes(),
    });
    expect(rows.some((row) => row.category === "pauta")).toBe(false);
  });
});

describe("12J — extensibilidade e fatos analíticos", () => {
  it("dois colegiados com governanças diferentes usam o mesmo motor", () => {
    const store = createCollegialStore({
      configurations: [demonstrationCollegialBodyA, demonstrationCollegialBodyB],
    });
    for (const [bodyId, natureId] of [
      ["col-demo-a", "nat-demo-a-1"],
      ["col-demo-b", "nat-demo-b-1"],
    ] as const)
      expect(
        store.openSession({
          actor: conductor,
          session: {
            id: `ses-${bodyId}`,
            bodyId,
            bodyConfigurationVersion: 1,
            natureId,
            scope: { classId: "turma-ficticia" },
            scheduledFor: "2027-12-10T18:00:00.000Z",
            participants: [],
            agenda: [],
          },
        }).ok,
      ).toBe(true);
  });

  it("produz fatos atômicos com proveniência, sem indicadores", () => {
    const { store } = storeWithSession("col-demo-a", "nat-demo-a-1");
    store.setParticipants({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      participants: participants(),
    });
    store.addAgendaItem({ actor: conductor, sessionId: "ses-col-demo-a", item: agendaItem() });
    store.registerDeliberation({
      actor: conductor,
      sessionId: "ses-col-demo-a",
      body: fictionalBody,
      deliberation: {
        agendaItemId: "item-1",
        bodyId: "col-demo-a",
        competenceId: "comp-ficticia-1",
        competenceLabel: "Competência fictícia",
        studentId: "aluno-ficticio",
        cycleId: "ciclo-ficticio",
        decisionMethodId: "dec-demo-a",
        votes: [
          { participantName: "Participante 1", optionId: "voto-demo-favoravel" },
          { participantName: "Participante 2", optionId: "voto-demo-favoravel" },
        ],
        decision: {
          outcomeId: "res-ficticio",
          outcomeLabel: "Resultado fictício",
          standingId: "sit-ficticia-x",
        },
        rationale: "Fundamentação fictícia.",
        dossier: dossier(1),
      },
      now: "2027-12-10T19:00:00.000Z",
    });
    const rows = collegialAnalyticRows({
      sessions: store.sessions(),
      deliberations: store.deliberationsOf("ses-col-demo-a"),
      minutes: store.minutes(),
    });
    const deliberationRow = rows.find((row) => row.category === "deliberacao");
    expect(deliberationRow?.dimensions["computedStandingId"]).toBe("sit-ficticia-y");
    expect(deliberationRow?.dimensions["resultingStandingId"]).toBe("sit-ficticia-x");
    expect(deliberationRow?.provenance["ruleSetVersion"]).toBe(3);
    expect(rows.filter((row) => row.category === "sessao")).toHaveLength(1);
  });
});
