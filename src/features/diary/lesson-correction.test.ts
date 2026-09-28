import { describe, expect, it } from "vitest";
import {
  lessonCorrectionSubmissionIssues,
  rectifyLessonRecord,
  resolveLessonCorrection,
  type LessonCorrectionPolicy,
} from "./lesson-correction";
import {
  createFirstLessonVersion,
  currentLessonVersion,
  hasLessonFactsChanged,
  isCurrentLessonVersion,
  lessonHistory,
  LESSON_CHANGE_ASPECTS,
  type LessonFacts,
  type LessonRecordVersion,
} from "./lesson-versions";
import { emptyLessonInput } from "./lesson-records";

const NOW = "2026-09-25T12:00:00.000Z";

function facts(overrides: Partial<LessonFacts> = {}): LessonFacts {
  return {
    ...emptyLessonInput("pro-006", "2026-09-21", "atp-001"),
    blockIds: ["bl-001", "bl-002"],
    quantity: 2,
    contentMode: "shared",
    contents: { shared: "Leitura compartilhada." },
    ...overrides,
  };
}

function v1(status: "Concluída" | "Em elaboração" = "Concluída"): LessonRecordVersion {
  return createFirstLessonVersion({
    logicalRecordId: "lr-001",
    versionId: "lr-001-v1",
    facts: facts(),
    status,
    now: NOW,
  });
}

const openPolicy: LessonCorrectionPolicy = {
  id: "pol-aula-sem-fechamento",
  version: 1,
  label: "Correção de registro sem fechamento oficial vigente",
  homologated: true,
  appliesWhenOfficialClosing: "absent",
  outcome: "admissible",
  requiredCapabilities: [],
  requirements: [],
  admissibleChanges: Object.values(LESSON_CHANGE_ASPECTS),
  disclosesNormativeContext: true,
};

const closedPolicy: LessonCorrectionPolicy = {
  id: "pol-aula-com-fechamento",
  version: 3,
  label: "Correção de registro em período com fechamento oficial",
  homologated: true,
  appliesWhenOfficialClosing: "present",
  outcome: "admissible",
  requiredCapabilities: ["executar-retificacao-de-registro-de-aula"],
  requirements: [
    {
      code: "justificativa",
      label: "Justificativa da correção",
      provenance: "Exigida pela regra vigente para períodos com fechamento oficial.",
    },
  ],
  admissibleChanges: [LESSON_CHANGE_ASPECTS.content, LESSON_CHANGE_ASPECTS.complements],
  disclosesNormativeContext: true,
};

const closing = { closingId: "fec-001", closingVersion: 1, periodLabel: "2º bimestre" };
const agent = { agentId: "pro-006", capabilities: [] as string[] };

describe("6D.2.1 — versionamento encadeado do registro de aula", () => {
  it("registro em elaboração não é retificado", () => {
    const projection = resolveLessonCorrection({
      baseVersionId: "lr-001-v1",
      versions: [v1("Em elaboração")],
      agent,
      policies: [openPolicy],
    });
    expect(projection.canCorrect).toBe(false);
    expect(projection.blockingReasons.map((item) => item.code)).toContain("registro-em-elaboracao");
  });

  it("produz v2 que APONTA para v1, sem conter seu passado", () => {
    const attempt = rectifyLessonRecord({
      correction: { baseVersionId: "lr-001-v1", versions: [v1()], agent, policies: [openPolicy] },
      submission: { facts: facts({ contents: { shared: "Leitura e reescrita coletiva." } }) },
      versionId: "lr-001-v2",
      now: NOW,
    });
    expect(attempt.registered).toBe(true);
    if (!attempt.registered) return;
    expect(attempt.version.version).toBe(2);
    expect(attempt.version.supersedesVersionId).toBe("lr-001-v1");
    expect(attempt.version).not.toHaveProperty("history");
    expect(attempt.version.rectification?.changedAspects).toEqual([LESSON_CHANGE_ASPECTS.content]);
  });

  it("v1 permanece íntegra e consultável no histórico derivado", () => {
    const base = v1();
    const attempt = rectifyLessonRecord({
      correction: { baseVersionId: base.id, versions: [base], agent, policies: [openPolicy] },
      submission: { facts: facts({ contents: { shared: "Outro conteúdo." } }) },
      versionId: "lr-001-v2",
      now: NOW,
    });
    if (!attempt.registered) throw new Error("esperava retificação");
    const chain = [base, attempt.version];
    expect(base.facts.contents["shared"]).toBe("Leitura compartilhada.");
    expect(currentLessonVersion(chain, "lr-001")?.id).toBe("lr-001-v2");
    expect(isCurrentLessonVersion(chain, "lr-001-v1")).toBe(false);
    const history = lessonHistory(chain, "lr-001");
    expect(history.map((item) => item.version)).toEqual([1, 2]);
    expect(history[0]?.current).toBe(false);
    expect(history[1]?.rectification?.policyId).toBe("pol-aula-sem-fechamento");
  });

  it("v1 → v2 → v3 mantém a cadeia reconstruível", () => {
    const base = v1();
    const second = rectifyLessonRecord({
      correction: { baseVersionId: base.id, versions: [base], agent, policies: [openPolicy] },
      submission: { facts: facts({ contents: { shared: "Versão dois." } }) },
      versionId: "lr-001-v2",
      now: NOW,
    });
    if (!second.registered) throw new Error("esperava v2");
    const versions = [base, second.version];
    const third = rectifyLessonRecord({
      correction: { baseVersionId: "lr-001-v2", versions, agent, policies: [openPolicy] },
      submission: { facts: facts({ contents: { shared: "Versão três." } }) },
      versionId: "lr-001-v3",
      now: NOW,
    });
    if (!third.registered) throw new Error("esperava v3");
    expect(third.version.supersedesVersionId).toBe("lr-001-v2");
    expect(third.version.version).toBe(3);
    expect(lessonHistory([...versions, third.version], "lr-001").map((i) => i.version)).toEqual([
      1, 2, 3,
    ]);
  });

  it("correção obsoleta (base já substituída) falha fechada", () => {
    const base = v1();
    const second = rectifyLessonRecord({
      correction: { baseVersionId: base.id, versions: [base], agent, policies: [openPolicy] },
      submission: { facts: facts({ contents: { shared: "Versão dois." } }) },
      versionId: "lr-001-v2",
      now: NOW,
    });
    if (!second.registered) throw new Error("esperava v2");
    const stale = rectifyLessonRecord({
      correction: {
        baseVersionId: "lr-001-v1",
        versions: [base, second.version],
        agent,
        policies: [openPolicy],
      },
      submission: { facts: facts({ contents: { shared: "Versão concorrente." } }) },
      versionId: "lr-001-v2-bis",
      now: NOW,
    });
    expect(stale.registered).toBe(false);
    if (stale.registered) return;
    expect(stale.issues.join(" ")).toContain("não é mais a versão vigente");
  });

  it("não cria versão fantasma quando nada muda efetivamente", () => {
    const base = v1();
    const attempt = rectifyLessonRecord({
      correction: { baseVersionId: base.id, versions: [base], agent, policies: [openPolicy] },
      submission: { facts: facts({ contents: { shared: "  Leitura compartilhada.  " } }) },
      versionId: "lr-001-v2",
      now: NOW,
    });
    expect(attempt.registered).toBe(false);
    if (attempt.registered) return;
    expect(attempt.issues).toContain("Nenhuma informação diferente do registro vigente.");
  });
});

describe("6D.2.1 — aulas geminadas como primeira classe", () => {
  const individual = facts({
    contentMode: "individual",
    contents: { "bl-001": "Parlendas.", "bl-002": "Reescrita." },
  });

  it("shared(v1) → individual(v2) é mudança efetiva de representação", () => {
    const delta = hasLessonFactsChanged(facts(), individual);
    expect(delta).toBe(true);
  });

  it("individual(v1) → shared(v2) preserva a carga horária e ainda muda a representação", () => {
    const shared = facts({ contents: { shared: "Parlendas e reescrita." } });
    expect(individual.quantity).toBe(shared.quantity);
    expect(hasLessonFactsChanged(individual, shared)).toBe(true);
  });

  it("individual → individual com mesmos textos não gera versão", () => {
    expect(hasLessonFactsChanged(individual, { ...individual })).toBe(false);
  });

  it("shared → shared com o mesmo texto não gera versão", () => {
    expect(hasLessonFactsChanged(facts(), facts())).toBe(false);
  });
});

describe("6D.2.1 — rito condicional e proteção de contexto", () => {
  it("sem fechamento, a regra não exige rito algum", () => {
    const projection = resolveLessonCorrection({
      baseVersionId: "lr-001-v1",
      versions: [v1()],
      agent,
      policies: [openPolicy, closedPolicy],
    });
    expect(projection.canCorrect).toBe(true);
    expect(projection.requiredRitual).toHaveLength(0);
    expect(projection.appliedPolicy?.id).toBe("pol-aula-sem-fechamento");
  });

  it("com fechamento, o rito exigido vem da regra — não da presença do fechamento", () => {
    const capable = { agentId: "pro-006", capabilities: [...closedPolicy.requiredCapabilities] };
    const projection = resolveLessonCorrection({
      baseVersionId: "lr-001-v1",
      versions: [v1()],
      agent: capable,
      policies: [openPolicy, closedPolicy],
      officialClosing: closing,
    });
    expect(projection.canCorrect).toBe(true);
    expect(projection.requiredRitual.map((item) => item.code)).toEqual(["justificativa"]);
    expect(projection.admissibleChanges).not.toContain(LESSON_CHANGE_ASPECTS.quantity);

    const issues = lessonCorrectionSubmissionIssues(projection, v1(), {
      facts: facts({ quantity: 1, contents: { shared: "Outro conteúdo." } }),
    });
    expect(issues.join(" ")).toContain("não admite alterar");
    expect(issues.join(" ")).toContain("Justificativa da correção");
  });

  it("mesmo com fechamento, regra que não exige justificativa não a inventa", () => {
    const silentPolicy: LessonCorrectionPolicy = {
      ...closedPolicy,
      id: "pol-rede-permissiva",
      requiredCapabilities: [],
      requirements: [],
    };
    const projection = resolveLessonCorrection({
      baseVersionId: "lr-001-v1",
      versions: [v1()],
      agent,
      policies: [silentPolicy],
      officialClosing: closing,
    });
    expect(projection.canCorrect).toBe(true);
    expect(projection.requiredRitual).toHaveLength(0);
  });

  it("sem regra homologada aplicável, nada é admitido", () => {
    const projection = resolveLessonCorrection({
      baseVersionId: "lr-001-v1",
      versions: [v1()],
      agent,
      policies: [{ ...closedPolicy, homologated: false }],
      officialClosing: closing,
    });
    expect(projection.canCorrect).toBe(false);
    expect(projection.blockingReasons.map((item) => item.code)).toContain("sem-regra-homologada");
  });

  it("capacidade ausente bloqueia sem citar cargo algum", () => {
    const projection = resolveLessonCorrection({
      baseVersionId: "lr-001-v1",
      versions: [v1()],
      agent,
      policies: [closedPolicy],
      officialClosing: closing,
    });
    expect(projection.canCorrect).toBe(false);
    const text = projection.disclosableReasons.map((item) => item.message).join(" ");
    expect(text).toContain("capacidade institucional");
    expect(text.toLowerCase()).not.toMatch(/professor|coordenador|secret/);
  });

  it("regra que não autoriza revelar o contexto normativo não o expõe", () => {
    const protectedPolicy: LessonCorrectionPolicy = {
      ...closedPolicy,
      id: "pol-reservada",
      disclosesNormativeContext: false,
    };
    const projection = resolveLessonCorrection({
      baseVersionId: "lr-001-v1",
      versions: [v1()],
      agent,
      policies: [protectedPolicy],
      officialClosing: closing,
    });
    expect(projection.canCorrect).toBe(false);
    expect(projection.consultedClosing).toBeUndefined();
    expect(projection.disclosableReasons).toHaveLength(0);
    expect(projection.blockingReasons.map((item) => item.code)).toContain("capacidade-ausente");
  });

  it("a proveniência da regra aplicada fica registrada no ato", () => {
    const capable = { agentId: "pro-006", capabilities: [...closedPolicy.requiredCapabilities] };
    const attempt = rectifyLessonRecord({
      correction: {
        baseVersionId: "lr-001-v1",
        versions: [v1()],
        agent: capable,
        policies: [closedPolicy],
        officialClosing: closing,
      },
      submission: {
        facts: facts({ contents: { shared: "Conteúdo corrigido." } }),
        justification: "Correção do conteúdo lançado na aula errada.",
      },
      versionId: "lr-001-v2",
      now: NOW,
    });
    expect(attempt.registered).toBe(true);
    if (!attempt.registered) return;
    const act = attempt.version.rectification!;
    expect(act.policyId).toBe("pol-aula-com-fechamento");
    expect(act.policyVersion).toBe(3);
    expect(act.consultedClosing?.closingId).toBe("fec-001");
    expect(act.justification).toBe("Correção do conteúdo lançado na aula errada.");
  });
});
