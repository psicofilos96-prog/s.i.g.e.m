/**
 * Etapa 6D.3.1 — adaptador do lançamento legado para a cadeia de versões.
 * Nada é descartado e nada é inventado.
 */
import { describe, expect, it } from "vitest";
import {
  assessmentVersionsFromLegacyEntry,
  LEGACY_RECTIFICATION_POLICY_ID,
} from "./assessment-entry-adapter";
import {
  assessmentEntryHistory,
  currentAssessmentEntryVersion,
} from "./assessment-entry-versions";
import type { AssessmentEntry } from "./assessment-types";

const legacy: AssessmentEntry = {
  id: "lan-ins-demo-001-alu-001",
  instrumentId: "ins-demo-001",
  studentId: "alu-001",
  placement: {
    enrollmentId: "mat-001",
    academicLinkId: "vin-001",
    participationId: "par-001",
    allocationId: "alo-001",
  },
  value: { kind: "numerica", value: 80 },
  valueLabel: "80",
  recordedAt: "2026-03-14T12:00:00.000Z",
  recordedByAssignmentId: "atp-001",
  status: "registrado",
  history: [
    {
      value: { kind: "numerica", value: 72 },
      valueLabel: "72",
      recordedAt: "2026-03-10T12:00:00.000Z",
      replacedAt: "2026-03-12T12:00:00.000Z",
      justification: "Erro de soma.",
    },
    {
      value: { kind: "numerica", value: 78 },
      valueLabel: "78",
      recordedAt: "2026-03-12T12:00:00.000Z",
      replacedAt: "2026-03-14T12:00:00.000Z",
      justification: "Revisão de prova.",
    },
  ],
};

describe("adaptador do lançamento legado", () => {
  const versions = assessmentVersionsFromLegacyEntry(legacy);

  it("preserva cada revisão como versão anterior da cadeia", () => {
    expect(versions.map((item) => item.version)).toEqual([1, 2, 3]);
    expect(versions.map((item) => item.value)).toEqual([
      { kind: "numerica", value: 72 },
      { kind: "numerica", value: 78 },
      { kind: "numerica", value: 80 },
    ]);
  });

  it("encadeia as versões por ponteiro de substituição", () => {
    expect(versions[0]?.supersedesVersionId).toBeUndefined();
    expect(versions[1]?.supersedesVersionId).toBe(versions[0]?.id);
    expect(versions[2]?.supersedesVersionId).toBe(versions[1]?.id);
  });

  it("a versão vigente é a última, e o histórico é projeção", () => {
    const current = currentAssessmentEntryVersion(versions, versions[0]!.logicalEntryId);
    expect(current?.value).toEqual({ kind: "numerica", value: 80 });
    expect(assessmentEntryHistory(versions, versions[0]!.logicalEntryId)).toHaveLength(3);
  });

  it("declara abertamente que a política aplicada não consta no registro legado", () => {
    expect(versions[2]?.rectification?.policyId).toBe(LEGACY_RECTIFICATION_POLICY_ID);
    expect(versions[2]?.rectification?.justification).toBe("Revisão de prova.");
    expect(versions[2]?.rectification?.satisfiedRequirements).toEqual([]);
    expect(versions[2]?.rectification?.consultedClosing).toBeUndefined();
  });

  it("lançamento sem correções gera cadeia de uma única versão, sem ato", () => {
    const { history: _history, ...withoutHistory } = legacy;
    const single = assessmentVersionsFromLegacyEntry(withoutHistory);
    expect(single).toHaveLength(1);
    expect(single[0]?.rectification).toBeUndefined();
    expect(single[0]?.version).toBe(1);
  });

  it("rascunho legado permanece rascunho na cadeia", () => {
    const draft = assessmentVersionsFromLegacyEntry({
      ...legacy,
      status: "rascunho",
      history: [],
    });
    expect(draft[0]?.status).toBe("rascunho");
  });

  it("não registrado é preservado sem conversão para zero", () => {
    const missing = assessmentVersionsFromLegacyEntry({
      ...legacy,
      value: { kind: "nao-registrado", reason: "Não realizou" },
      history: [],
    });
    expect(missing[0]?.value).toEqual({ kind: "nao-registrado", reason: "Não realizou" });
  });
});
