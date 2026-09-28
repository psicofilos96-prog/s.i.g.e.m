/**
 * Etapa 6D.3.1 — versionamento imutável do resultado avaliativo.
 * Cobre cadeia, projeções, mudança semântica e as quatro naturezas de valor.
 */
import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_CHANGE_ASPECTS,
  assessmentEntryChain,
  assessmentEntryHistory,
  assessmentLogicalEntryId,
  assessmentValueDelta,
  createFirstAssessmentEntryVersion,
  createSupersedingAssessmentEntryVersion,
  currentAssessmentEntryVersion,
  hasAssessmentValueChanged,
  isCurrentAssessmentEntryVersion,
  registerAssessmentEntryVersion,
  sameAssessmentValue,
  type AssessmentEntryVersion,
  type AssessmentRectificationAct,
} from "./assessment-entry-versions";
import type { EntryValue } from "./assessment-types";

const placement = {
  enrollmentId: "mat-001",
  academicLinkId: "vin-001",
  participationId: "par-001",
  allocationId: "alo-001",
};

function firstVersion(value: EntryValue, status: "rascunho" | "registrado" = "registrado") {
  return createFirstAssessmentEntryVersion({
    versionId: "v1",
    instrumentId: "ins-demo-001",
    studentId: "alu-001",
    placement,
    value,
    status,
    recordedByAssignmentId: "atp-001",
    now: "2026-03-10T12:00:00.000Z",
  });
}

const act = (changed: readonly string[]): AssessmentRectificationAct => ({
  actedAt: "2026-03-12T12:00:00.000Z",
  agentId: "pro-006",
  policyId: "pol-demo",
  policyVersion: 1,
  policyLabel: "Política demonstrativa",
  satisfiedRequirements: [],
  changedAspects: changed,
});

describe("identidade lógica e primeira versão", () => {
  it("deriva o identificador lógico de instrumento + estudante", () => {
    expect(assessmentLogicalEntryId("ins-1", "alu-1")).toBe("res-ins-1-alu-1");
  });

  it("nasce na versão 1 sem ponteiro de substituição e sem ato de retificação", () => {
    const v1 = firstVersion({ kind: "numerica", value: 72 });
    expect(v1.version).toBe(1);
    expect(v1.supersedesVersionId).toBeUndefined();
    expect(v1.rectification).toBeUndefined();
    expect(v1.logicalEntryId).toBe("res-ins-demo-001-alu-001");
  });

  it("conclusão do rascunho não cria nova versão da cadeia", () => {
    const draft = firstVersion({ kind: "numerica", value: 72 }, "rascunho");
    const registered = registerAssessmentEntryVersion(draft, "2026-03-11T00:00:00.000Z");
    expect(registered.version).toBe(1);
    expect(registered.status).toBe("registrado");
    expect(registered.supersedesVersionId).toBeUndefined();
  });
});

describe("cadeia v1 → v2 → v3", () => {
  const v1 = firstVersion({ kind: "numerica", value: 72 });
  const v2 = createSupersedingAssessmentEntryVersion({
    base: v1,
    versionId: "v2",
    value: { kind: "numerica", value: 78 },
    rectification: act([ASSESSMENT_CHANGE_ASPECTS.value]),
    now: "2026-03-12T12:00:00.000Z",
  });
  const v3 = createSupersedingAssessmentEntryVersion({
    base: v2,
    versionId: "v3",
    value: { kind: "numerica", value: 80 },
    rectification: act([ASSESSMENT_CHANGE_ASPECTS.value]),
    now: "2026-03-13T12:00:00.000Z",
  });
  const versions: AssessmentEntryVersion[] = [v1, v2, v3];

  it("cada versão aponta para a anterior e incrementa o número", () => {
    expect(v2.supersedesVersionId).toBe("v1");
    expect(v3.supersedesVersionId).toBe("v2");
    expect(v3.version).toBe(3);
  });

  it("a versão vigente é a última não substituída", () => {
    expect(currentAssessmentEntryVersion(versions, v1.logicalEntryId)?.id).toBe("v3");
    expect(isCurrentAssessmentEntryVersion(versions, "v3")).toBe(true);
    expect(isCurrentAssessmentEntryVersion(versions, "v1")).toBe(false);
  });

  it("preserva integralmente as versões anteriores, com seus valores originais", () => {
    const chain = assessmentEntryChain(versions, v1.logicalEntryId);
    expect(chain.map((item) => item.id)).toEqual(["v1", "v2", "v3"]);
    expect(chain[0]?.value).toEqual({ kind: "numerica", value: 72 });
    expect(chain[1]?.value).toEqual({ kind: "numerica", value: 78 });
  });

  it("o histórico é projeção da cadeia, não campo guardado na versão vigente", () => {
    const history = assessmentEntryHistory(versions, v1.logicalEntryId);
    expect(history.map((line) => line.current)).toEqual([false, false, true]);
    expect(history[2]?.rectification?.policyId).toBe("pol-demo");
    expect(Object.keys(v3)).not.toContain("history");
  });

  it("versão registrada é congelada em memória", () => {
    expect(Object.isFrozen(v1)).toBe(true);
    expect(() => {
      (v1 as { status: string }).status = "rascunho";
    }).toThrow();
  });

  it("preserva o contexto acadêmico da época na versão que substitui", () => {
    expect(v2.placement).toEqual(placement);
    expect(v2.instrumentId).toBe(v1.instrumentId);
    expect(v2.studentId).toBe(v1.studentId);
  });
});

describe("mudança factual efetiva nas quatro naturezas", () => {
  it("valor numérico idêntico não é mudança", () => {
    expect(
      hasAssessmentValueChanged(
        { value: { kind: "numerica", value: 72 } },
        { value: { kind: "numerica", value: 72 } },
      ),
    ).toBe(false);
  });

  it("conceito idêntico não é mudança; conceito diferente é", () => {
    expect(
      sameAssessmentValue(
        { kind: "conceitual", optionId: "cc-demo-1" },
        { kind: "conceitual", optionId: "cc-demo-1" },
      ),
    ).toBe(true);
    expect(
      assessmentValueDelta(
        { value: { kind: "conceitual", optionId: "cc-demo-1" } },
        { value: { kind: "conceitual", optionId: "cc-demo-2" } },
      ),
    ).toEqual([ASSESSMENT_CHANGE_ASPECTS.value]);
  });

  it("texto descritivo apenas reespaçado não é mudança", () => {
    expect(
      hasAssessmentValueChanged(
        { value: { kind: "descritiva", text: "Leitura   fluente" } },
        { value: { kind: "descritiva", text: " Leitura fluente " } },
      ),
    ).toBe(false);
  });

  it("mudar o motivo do não registrado é mudança do motivo, não do resultado", () => {
    expect(
      assessmentValueDelta(
        { value: { kind: "nao-registrado", reason: "Não realizou" } },
        { value: { kind: "nao-registrado", reason: "Atividade não aplicada" } },
      ),
    ).toEqual([ASSESSMENT_CHANGE_ASPECTS.missingReason]);
  });

  it("não registrado e zero NÃO são equivalentes", () => {
    expect(
      sameAssessmentValue(
        { kind: "nao-registrado", reason: "Não realizou" },
        { kind: "numerica", value: 0 },
      ),
    ).toBe(false);
    expect(
      assessmentValueDelta(
        { value: { kind: "nao-registrado", reason: "Não realizou" } },
        { value: { kind: "numerica", value: 0 } },
      ),
    ).toEqual([ASSESSMENT_CHANGE_ASPECTS.valueKind]);
  });

  it("conceito e número nunca são equivalentes entre si", () => {
    expect(
      sameAssessmentValue({ kind: "conceitual", optionId: "cc-1" }, { kind: "numerica", value: 1 }),
    ).toBe(false);
  });

  it("mudar apenas a origem declarada é mudança de origem", () => {
    expect(
      assessmentValueDelta(
        { value: { kind: "numerica", value: 72 }, origin: "diario" },
        { value: { kind: "numerica", value: 72 }, origin: "transferencia-externa" },
      ),
    ).toEqual([ASSESSMENT_CHANGE_ASPECTS.origin]);
  });
});
