/** Etapa 6D.3.3.1 — testes da Assessment Period Projection. */
import { describe, expect, it } from "vitest";
import { compositionModels } from "./assessment-composition-fixtures";
import type { CompositionModel } from "./assessment-composition-types";
import {
  ASSESSMENT_PERIOD_UNAVAILABLE_REASONS,
  projectAssessmentPeriod,
  type ProjectAssessmentPeriodInput,
} from "./assessment-period-projection";
import {
  createFirstAssessmentEntryVersion,
  createSupersedingAssessmentEntryVersion,
} from "./assessment-entry-versions";
import { assessmentConfigurations } from "./assessment-fixtures";
import type { AcademicPlacement, AssessmentInstrument, EntryValue } from "./assessment-types";

const demoConfig = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const quantitativa = { ...demoConfig, pendingRuleIds: [] };
const demoModel = compositionModels.find((m) => m.id === "mc-demo-quantitativa")!;
const homologated: CompositionModel = {
  ...demoModel,
  normativeStatus: "homologado",
  configurationVersion: demoConfig.version,
  rounding: { ...demoModel.rounding, normativeStatus: "homologado" },
};

const placement = (studentId: string, from = "2026-02-01"): AcademicPlacement => ({
  participationNature: "regular",
  studentId,
  enrollmentId: "enr-1",
  unitId: "un-1",
  academicLinkId: "lnk-1",
  participationId: "par-1",
  allocationId: "alo-1",
  classId: "cls-1",
  from,
  until: null,
});

const inst = (id: string, instrumentTypeId: string, appliedOn: string): AssessmentInstrument =>
  ({
    id,
    configurationId: quantitativa.id,
    periodId: "per-1",
    pedagogicalAssignmentId: "atu-1",
    classId: "cls-1",
    instrumentTypeId,
    title: `Instrumento ${id}`,
    appliedOn,
    snapshot: { classLabel: "Turma", fieldLabel: "Componente" },
  }) as AssessmentInstrument;

const version = (instrumentId: string, studentId: string, value: EntryValue, status: "rascunho" | "registrado" = "registrado") =>
  createFirstAssessmentEntryVersion({
    versionId: `v-${instrumentId}-${studentId}`,
    instrumentId,
    studentId,
    placement: { enrollmentId: "enr-1", academicLinkId: "lnk-1", participationId: "par-1", allocationId: "alo-1" },
    value,
    status,
    recordedByAssignmentId: "atu-1",
    now: "2026-04-11T10:00:00.000Z",
  });

const base = (over: Partial<ProjectAssessmentPeriodInput> = {}): ProjectAssessmentPeriodInput => ({
  context: { classId: "cls-1", classLabel: "Turma" },
  period: { id: "per-1", label: "Período 1" },
  configuration: quantitativa,
  compositionModel: homologated,
  instruments: [inst("i-ativ", "it-atividade", "2026-03-01"), inst("i-prova", "it-prova", "2026-04-10")],
  students: [
    { studentId: "s1", displayName: "Ana", rollNumber: 1, placements: [placement("s1")], identityDiscriminator: "M-1" },
    { studentId: "s2", displayName: "Bruno", rollNumber: 2, placements: [placement("s2")] },
    { studentId: "s3", displayName: "Caio", rollNumber: 3, placements: [placement("s3", "2026-05-01")] },
  ],
  versions: [
    version("i-ativ", "s1", { kind: "numerica", value: 80 }),
    version("i-prova", "s1", { kind: "numerica", value: 61 }),
    version("i-ativ", "s2", { kind: "nao-registrado", reason: "Ausência justificada" }),
    version("i-prova", "s2", { kind: "numerica", value: 90 }, "rascunho"),
  ],
  agent: { agentId: "prof-1", capabilities: ["lancar", "retificar", "ler-valores"] },
  actionDefinitions: [
    { actionId: "abrir-pauta", label: "Abrir pauta", target: "instrument", requiredCapabilities: ["lancar"] },
    { actionId: "corrigir", label: "Corrigir", target: "result", requiredCapabilities: ["retificar"], admissibleCellStates: ["recorded", "explicitly-unrecorded"] },
  ],
  valueReadCapability: "ler-valores",
  ...over,
});

const available = (input = base()) => {
  const p = projectAssessmentPeriod(input);
  if (p.state !== "period-available") throw new Error("indisponível");
  return p;
};
const cell = (p: ReturnType<typeof available>, s: string, i: string) =>
  p.students.find((x) => x.studentId === s)!.cells.find((c) => c.instrumentId === i)!;

describe("6D.3.3.1 — Assessment Period Projection", () => {
  it("distingue registrado, não registrado explícito, sem registro e não aplicável", () => {
    const p = available();
    expect(cell(p, "s1", "i-ativ").state).toBe("recorded");
    expect(cell(p, "s2", "i-ativ").state).toBe("explicitly-unrecorded");
    expect(cell(p, "s2", "i-ativ").unrecordedReason).toBe("Ausência justificada");
    expect(cell(p, "s2", "i-prova").state).toBe("unrecorded");
    expect(cell(p, "s3", "i-ativ").state).toBe("not-applicable");
    expect(cell(p, "s2", "i-prova").currentValue).toBeUndefined();
    expect(p.balance).toMatchObject({ cellsRecorded: 2, cellsExplicitlyUnrecorded: 1, cellsUnrecorded: 1, cellsNotApplicable: 2 });
  });

  it("rascunho nunca entra na projeção", () => {
    const p = available();
    expect(cell(p, "s2", "i-prova").currentVersionId).toBeUndefined();
  });

  it("usa apenas a versão vigente", () => {
    const v1 = version("i-ativ", "s1", { kind: "numerica", value: 80 });
    const v2 = createSupersedingAssessmentEntryVersion({
      base: v1,
      versionId: "v2",
      value: { kind: "numerica", value: 70 },
      recordedByAssignmentId: "atu-1",
      now: "2026-04-12T10:00:00.000Z",
      rectification: { actId: "a1", reason: "correção", at: "2026-04-12T10:00:00.000Z" },
    } as never);
    const p = available(base({ versions: [v1, v2] }));
    expect(cell(p, "s1", "i-ativ").currentVersionId).toBe("v2");
    expect(cell(p, "s1", "i-ativ").currentVersionNumber).toBe(2);
  });

  it("composição vem do motor canônico, com proveniência e nunca oficial", () => {
    const p = available();
    const c = p.students[0]!.composition;
    expect(c.kind).toBe("composed");
    if (c.kind !== "composed") return;
    expect(c.complete).toBe(true);
    expect(c.stage?.value).toBe(71);
    expect(c.official).toBe(false);
    expect(c.provenance.usedVersionIds).toHaveLength(2);
    const s2 = p.students[1]!.composition;
    expect(s2.kind === "composed" && s2.complete).toBe(false);
  });

  it("sem regra homologada a composição fica bloqueada por extenso", () => {
    const p = available(base({ compositionModel: demoModel }));
    const c = p.students[0]!.composition;
    expect(c.kind).toBe("blocked");
    if (c.kind === "blocked") expect(c.reasons.length).toBeGreaterThan(0);
    expect(available(base({ compositionModel: undefined })).students[0]!.composition.kind).toBe("blocked");
  });

  it("ações seguem capacidades e falham fechadas", () => {
    let p = available();
    expect(p.instruments[0]!.actions[0]).toMatchObject({ actionId: "abrir-pauta", available: true });
    expect(cell(p, "s1", "i-ativ").actions[0]).toMatchObject({ available: true });
    expect(cell(p, "s2", "i-prova").actions).toHaveLength(0);
    p = available(base({ agent: { agentId: "x", capabilities: ["ler-valores"] } }));
    expect(p.instruments[0]!.actions[0]!.available).toBe(false);
    expect(cell(p, "s1", "i-ativ").actions[0]!.available).toBe(false);
  });

  it("suprime valores e composição sem capacidade de leitura", () => {
    const p = available(base({ agent: { agentId: "x", capabilities: [] } }));
    const c = cell(p, "s1", "i-ativ");
    expect(c.valueDisclosure).toBe("suppressed");
    expect(c.currentValue).toBeUndefined();
    expect(cell(p, "s2", "i-ativ").unrecordedReason).toBeUndefined();
    expect(p.students[0]!.composition.kind).toBe("suppressed");
    expect(p.disclosures.length).toBe(1);
  });

  it("discriminador aparece apenas em homônimos", () => {
    expect(available().students[0]!.identityDiscriminator).toBeUndefined();
    const students = base().students.map((s) => ({ ...s, displayName: "Ana", identityDiscriminator: `M-${s.studentId}` }));
    expect(available(base({ students })).students[0]!.identityDiscriminator).toBe("M-s1");
  });

  it("contextos indisponíveis são estruturados", () => {
    expect(projectAssessmentPeriod(base({ period: undefined }))).toMatchObject({ state: "period-unavailable", reason: ASSESSMENT_PERIOD_UNAVAILABLE_REASONS.periodMissing });
    expect(projectAssessmentPeriod(base({ configuration: undefined }))).toMatchObject({ reason: ASSESSMENT_PERIOD_UNAVAILABLE_REASONS.configurationMissing });
    expect(projectAssessmentPeriod(base({ instruments: [] }))).toMatchObject({ reason: ASSESSMENT_PERIOD_UNAVAILABLE_REASONS.noInstruments });
  });

  it("é serializável, idempotente e não muta a entrada", () => {
    const input = base();
    const snapshot = JSON.stringify(input);
    const a = projectAssessmentPeriod(input);
    const b = projectAssessmentPeriod(input);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(a).toEqual(b);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
