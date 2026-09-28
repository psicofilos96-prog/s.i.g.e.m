/**
 * Etapa 6D.3.1 — Assessment Correction Resolver.
 *
 * Nenhum cargo autoriza: tudo decorre de capacidades, configuração aplicável,
 * política homologada e fechamento vigente. Nenhuma natureza é privilegiada.
 */
import { describe, expect, it } from "vitest";
import {
  rectifyAssessmentEntry,
  resolveAssessmentCorrection,
  type AssessmentCorrectionInput,
  type AssessmentCorrectionPolicy,
} from "./assessment-correction";
import {
  createFirstAssessmentEntryVersion,
  createSupersedingAssessmentEntryVersion,
  type AssessmentEntryVersion,
} from "./assessment-entry-versions";
import { assessmentConfigurations } from "./assessment-fixtures";
import type { AssessmentConfiguration, EntryValue } from "./assessment-types";

const quantitative = assessmentConfigurations.find(
  (item) => item.id === "cfg-2026-quantitativa-demo",
)!;
const conceptual = assessmentConfigurations.find(
  (item) => item.id === "cfg-2026-conceitual-demo",
)!;
const infantEducation = assessmentConfigurations.find(
  (item) => item.id === "cfg-2026-ei-acompanhamento",
)!;

const instrument = {
  id: "ins-demo-001",
  instrumentTypeId: "it-atividade",
  status: "aplicado" as const,
};

const placement = {
  enrollmentId: "mat-001",
  academicLinkId: "vin-001",
  participationId: "par-001",
  allocationId: "alo-001",
};

function version(value: EntryValue, status: "rascunho" | "registrado" = "registrado") {
  return createFirstAssessmentEntryVersion({
    versionId: "v1",
    instrumentId: instrument.id,
    studentId: "alu-001",
    placement,
    value,
    status,
    recordedByAssignmentId: "atp-001",
    now: "2026-03-10T12:00:00.000Z",
  });
}

/** Política sem rito adicional: correção livre quando não há fechamento. */
const freePolicy: AssessmentCorrectionPolicy = {
  id: "pol-sem-fechamento",
  version: 1,
  label: "Correção antes do fechamento do período",
  homologated: true,
  appliesWhenPeriodClosing: "absent",
  outcome: "admissible",
  requiredCapabilities: [],
  requirements: [],
  disclosesNormativeContext: true,
};

/** Política com rito: fechamento vigente exige justificativa e capacidade. */
const closedPeriodPolicy: AssessmentCorrectionPolicy = {
  id: "pol-com-fechamento",
  version: 2,
  label: "Correção após o fechamento do período",
  homologated: true,
  appliesWhenPeriodClosing: "present",
  outcome: "admissible",
  requiredCapabilities: ["corrigir-resultado-apos-fechamento"],
  requirements: [
    {
      code: "justificativa",
      label: "Justificativa da correção",
      provenance: "Exigida pela regra de correção após o fechamento do período.",
    },
  ],
  disclosesNormativeContext: true,
};

const closing = {
  closingId: "fec-demonstrativo-001",
  closingVersion: 1,
  periodLabel: "Período demonstrativo 1",
};

function input(overrides: Partial<AssessmentCorrectionInput> = {}): AssessmentCorrectionInput {
  const versions = overrides.versions ?? [version({ kind: "numerica", value: 72 })];
  return {
    baseVersionId: overrides.baseVersionId ?? versions[0]!.id,
    versions,
    agent: overrides.agent ?? { agentId: "pro-006", capabilities: [] },
    instrument,
    configuration: overrides.configuration ?? quantitative,
    policies: overrides.policies ?? [freePolicy],
    ...(overrides.periodClosing ? { periodClosing: overrides.periodClosing } : {}),
    ...(overrides.context ? { context: overrides.context } : {}),
  };
}

describe("rito condicional", () => {
  it("sem fechamento vigente, nenhuma exigência é inventada", () => {
    const projection = resolveAssessmentCorrection(input());
    expect(projection.canCorrect).toBe(true);
    expect(projection.requiredRitual).toEqual([]);
    expect(projection.requiredCapabilities).toEqual([]);
    expect(projection.appliedPolicy?.id).toBe("pol-sem-fechamento");
  });

  it("com fechamento vigente, o rito é o que a política homologada declara", () => {
    const projection = resolveAssessmentCorrection(
      input({
        policies: [freePolicy, closedPeriodPolicy],
        periodClosing: closing,
        agent: { agentId: "sec-001", capabilities: ["corrigir-resultado-apos-fechamento"] },
      }),
    );
    expect(projection.canCorrect).toBe(true);
    expect(projection.requiredRitual.map((item) => item.code)).toEqual(["justificativa"]);
    expect(projection.consultedClosing?.closingId).toBe("fec-demonstrativo-001");
  });

  it("sem política homologada aplicável, falha fechada", () => {
    const projection = resolveAssessmentCorrection(
      input({ policies: [{ ...freePolicy, homologated: false }] }),
    );
    expect(projection.canCorrect).toBe(false);
    expect(projection.blockingReasons.map((item) => item.code)).toContain(
      "sem-politica-homologada",
    );
    expect(projection.admissibleValueKinds).toEqual([]);
  });

  it("política que proíbe a correção bloqueia com o motivo declarado", () => {
    const projection = resolveAssessmentCorrection(
      input({
        policies: [
          {
            ...freePolicy,
            outcome: "forbidden",
            forbiddenReason: "Resultado consolidado em ata de colegiado.",
          },
        ],
      }),
    );
    expect(projection.canCorrect).toBe(false);
    expect(projection.disclosableReasons.map((item) => item.message)).toContain(
      "Resultado consolidado em ata de colegiado.",
    );
  });
});

describe("capacidades e proteção contra inferência", () => {
  it("agente sem a capacidade exigida não corrige", () => {
    const projection = resolveAssessmentCorrection(
      input({ policies: [closedPeriodPolicy], periodClosing: closing }),
    );
    expect(projection.canCorrect).toBe(false);
    expect(projection.blockingReasons.map((item) => item.code)).toContain("capacidade-ausente");
    expect(projection.requiredCapabilities).toEqual(["corrigir-resultado-apos-fechamento"]);
  });

  it("política que não autoriza revelar o contexto não anuncia fechamento nem capacidade", () => {
    const projection = resolveAssessmentCorrection(
      input({
        policies: [{ ...closedPeriodPolicy, disclosesNormativeContext: false }],
        periodClosing: closing,
      }),
    );
    expect(projection.consultedClosing).toBeUndefined();
    expect(projection.disclosableReasons).toEqual([]);
    const messages = projection.blockingReasons.map((item) => item.message).join(" ");
    expect(messages).not.toContain("corrigir-resultado-apos-fechamento");
    expect(messages).not.toContain("fec-demonstrativo-001");
  });

  it("o resolvedor não decide por cargo: mesma política, capacidades diferentes", () => {
    const base = { policies: [closedPeriodPolicy], periodClosing: closing };
    const blocked = resolveAssessmentCorrection(
      input({ ...base, agent: { agentId: "pro-006", capabilities: [] } }),
    );
    const allowed = resolveAssessmentCorrection(
      input({
        ...base,
        agent: { agentId: "pro-006", capabilities: ["corrigir-resultado-apos-fechamento"] },
      }),
    );
    expect(blocked.canCorrect).toBe(false);
    expect(allowed.canCorrect).toBe(true);
  });
});

describe("naturezas admissíveis por configuração", () => {
  it("configuração quantitativa admite número, descrição e não registrado", () => {
    const projection = resolveAssessmentCorrection(input());
    expect(projection.admissibleValueKinds).toContain("numerica");
    expect(projection.admissibleValueKinds).toContain("nao-registrado");
    expect(projection.admissibleValueKinds).not.toContain("conceitual");
    expect(projection.configuredSemantics).toEqual(["quantitativa"]);
  });

  it("configuração conceitual projeta os conceitos admissíveis, nunca uma escala numérica inventada", () => {
    const projection = resolveAssessmentCorrection(
      input({
        configuration: conceptual,
        versions: [version({ kind: "conceitual", optionId: "cc-demo-1" })],
      }),
    );
    expect(projection.admissibleValueKinds).toContain("conceitual");
    const conceptualValues = projection.admissibleValues.find(
      (item) => item.kind === "conceitual",
    );
    expect(conceptualValues && conceptualValues.kind === "conceitual"
      ? conceptualValues.options.map((option) => option.id)
      : []).toEqual(["cc-demo-1", "cc-demo-2"]);
  });

  it("contexto que não trabalha com instrumento avaliativo não tem correção de resultado", () => {
    const projection = resolveAssessmentCorrection(
      input({
        configuration: infantEducation,
        versions: [version({ kind: "descritiva", text: "Registro de observação" })],
      }),
    );
    expect(projection.canCorrect).toBe(false);
    expect(projection.blockingReasons.map((item) => item.code)).toContain(
      "contexto-sem-instrumento-avaliativo",
    );
  });

  it("a política pode restringir naturezas sem que o motor as enumere", () => {
    const projection = resolveAssessmentCorrection(
      input({ policies: [{ ...freePolicy, admissibleValueKinds: ["numerica"] }] }),
    );
    expect(projection.admissibleValueKinds).toEqual(["numerica"]);
  });
});

describe("estado da versão e concorrência", () => {
  it("resultado em rascunho não é corrigido: é editado na pauta", () => {
    const projection = resolveAssessmentCorrection(
      input({ versions: [version({ kind: "numerica", value: 72 }, "rascunho")] }),
    );
    expect(projection.canCorrect).toBe(false);
    expect(projection.blockingReasons.map((item) => item.code)).toContain(
      "resultado-em-rascunho",
    );
  });

  it("correção iniciada sobre versão já superada falha fechada", () => {
    const v1 = version({ kind: "numerica", value: 72 });
    const v2 = createSupersedingAssessmentEntryVersion({
      base: v1,
      versionId: "v2",
      value: { kind: "numerica", value: 78 },
      rectification: {
        actedAt: "2026-03-12T12:00:00.000Z",
        agentId: "pro-006",
        policyId: freePolicy.id,
        policyVersion: freePolicy.version,
        policyLabel: freePolicy.label,
        satisfiedRequirements: [],
        changedAspects: ["resultado-registrado"],
      },
      now: "2026-03-12T12:00:00.000Z",
    });
    const attempt = rectifyAssessmentEntry({
      correction: input({ versions: [v1, v2], baseVersionId: "v1" }),
      submission: { value: { kind: "numerica", value: 90 } },
      versionId: "v3",
      now: "2026-03-13T12:00:00.000Z",
    });
    expect(attempt.registered).toBe(false);
    expect(attempt.registered === false && attempt.issues.join(" ")).toContain(
      "não é mais a versão vigente",
    );
  });

  it("versão inexistente não produz correção", () => {
    const projection = resolveAssessmentCorrection(input({ baseVersionId: "inexistente" }));
    expect(projection.blockingReasons.map((item) => item.code)).toContain("versao-inexistente");
  });
});

describe("ato de retificação", () => {
  it("correção sem alteração efetiva não gera nova versão", () => {
    const attempt = rectifyAssessmentEntry({
      correction: input(),
      submission: { value: { kind: "numerica", value: 72 } },
      versionId: "v2",
      now: "2026-03-12T12:00:00.000Z",
    });
    expect(attempt.registered).toBe(false);
    expect(attempt.registered === false && attempt.issues).toContain(
      "Nenhuma informação diferente do resultado vigente.",
    );
  });

  it("numérico → numérico gera v2 encadeada e preserva v1", () => {
    const attempt = rectifyAssessmentEntry({
      correction: input(),
      submission: { value: { kind: "numerica", value: 78 } },
      versionId: "v2",
      now: "2026-03-12T12:00:00.000Z",
    });
    expect(attempt.registered).toBe(true);
    if (!attempt.registered) return;
    expect(attempt.version.version).toBe(2);
    expect(attempt.version.supersedesVersionId).toBe("v1");
    expect(attempt.version.value).toEqual({ kind: "numerica", value: 78 });
    expect(attempt.version.rectification?.changedAspects).toEqual(["resultado-registrado"]);
  });

  it("conceitual → conceitual gera nova versão na mesma natureza", () => {
    const attempt = rectifyAssessmentEntry({
      correction: input({
        configuration: conceptual,
        versions: [version({ kind: "conceitual", optionId: "cc-demo-1" })],
      }),
      submission: { value: { kind: "conceitual", optionId: "cc-demo-2" } },
      versionId: "v2",
      now: "2026-03-12T12:00:00.000Z",
    });
    expect(attempt.registered).toBe(true);
    if (attempt.registered)
      expect(attempt.version.value).toEqual({ kind: "conceitual", optionId: "cc-demo-2" });
  });

  it("descritivo → descritivo gera nova versão quando o texto realmente muda", () => {
    const attempt = rectifyAssessmentEntry({
      correction: input({
        configuration: conceptual,
        versions: [version({ kind: "descritiva", text: "Leitura em desenvolvimento" })],
      }),
      submission: { value: { kind: "descritiva", text: "Leitura fluente" } },
      versionId: "v2",
      now: "2026-03-12T12:00:00.000Z",
    });
    expect(attempt.registered).toBe(true);
  });

  it("não registrado → resultado é admitido quando a configuração e a política admitem", () => {
    const attempt = rectifyAssessmentEntry({
      correction: input({
        versions: [version({ kind: "nao-registrado", reason: "Não realizou a atividade" })],
      }),
      submission: { value: { kind: "numerica", value: 65 } },
      versionId: "v2",
      now: "2026-03-12T12:00:00.000Z",
    });
    expect(attempt.registered).toBe(true);
    if (attempt.registered)
      expect(attempt.version.rectification?.changedAspects).toEqual(["natureza-do-resultado"]);
  });

  it("resultado → não registrado exige motivo e é admitido quando a política permite", () => {
    const withoutReason = rectifyAssessmentEntry({
      correction: input(),
      submission: { value: { kind: "nao-registrado", reason: "  " } },
      versionId: "v2",
      now: "2026-03-12T12:00:00.000Z",
    });
    expect(withoutReason.registered).toBe(false);

    const withReason = rectifyAssessmentEntry({
      correction: input(),
      submission: { value: { kind: "nao-registrado", reason: "Atividade não aplicada à turma" } },
      versionId: "v2",
      now: "2026-03-12T12:00:00.000Z",
    });
    expect(withReason.registered).toBe(true);
  });

  it("política que não admite transformar resultado em não registrado bloqueia a natureza", () => {
    const attempt = rectifyAssessmentEntry({
      correction: input({
        policies: [{ ...freePolicy, admissibleValueKinds: ["numerica"] }],
      }),
      submission: { value: { kind: "nao-registrado", reason: "Não realizou" } },
      versionId: "v2",
      now: "2026-03-12T12:00:00.000Z",
    });
    expect(attempt.registered).toBe(false);
    expect(attempt.registered === false && attempt.issues.join(" ")).toContain(
      "não admite registrar este resultado nesta natureza",
    );
  });

  it("rito exigido pelo fechamento bloqueia sem justificativa e registra a proveniência com ela", () => {
    const correction = input({
      policies: [closedPeriodPolicy],
      periodClosing: closing,
      agent: { agentId: "sec-001", capabilities: ["corrigir-resultado-apos-fechamento"] },
    });
    const withoutJustification = rectifyAssessmentEntry({
      correction,
      submission: { value: { kind: "numerica", value: 78 } },
      versionId: "v2",
      now: "2026-03-12T12:00:00.000Z",
    });
    expect(withoutJustification.registered).toBe(false);

    const withJustification = rectifyAssessmentEntry({
      correction,
      submission: {
        value: { kind: "numerica", value: 78 },
        justification: "Erro de soma na correção da prova.",
      },
      versionId: "v2",
      now: "2026-03-12T12:00:00.000Z",
    });
    expect(withJustification.registered).toBe(true);
    if (!withJustification.registered) return;
    const rectification = withJustification.version.rectification!;
    expect(rectification.justification).toBe("Erro de soma na correção da prova.");
    expect(rectification.policyId).toBe("pol-com-fechamento");
    expect(rectification.consultedClosing?.closingId).toBe("fec-demonstrativo-001");
    expect(rectification.exercisedCapabilities).toEqual(["corrigir-resultado-apos-fechamento"]);
  });

  it("valor fora da escala configurada não gera versão", () => {
    const attempt = rectifyAssessmentEntry({
      correction: input(),
      submission: { value: { kind: "numerica", value: 105 } },
      versionId: "v2",
      now: "2026-03-12T12:00:00.000Z",
    });
    expect(attempt.registered).toBe(false);
  });
});

describe("fronteiras da etapa", () => {
  it("a projeção não produz resultado, média, situação nem fechamento", () => {
    const projection = resolveAssessmentCorrection(input()) as unknown as Record<string, unknown>;
    for (const forbidden of ["result", "average", "standing", "closing", "composition"])
      expect(Object.keys(projection)).not.toContain(forbidden);
  });

  it("a configuração aplicável nunca é reinterpretada pelo resolvedor", () => {
    const snapshot: AssessmentConfiguration = structuredClone(quantitative);
    resolveAssessmentCorrection(input());
    expect(quantitative).toEqual(snapshot);
  });
});
