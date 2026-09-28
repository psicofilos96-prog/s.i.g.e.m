/** 6D.3.3.2 (microcorreção) — "Resultado corrigido" derivado da cadeia e nomes acessíveis. */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { compositionModels } from "./assessment-composition-fixtures";
import {
  ASSESSMENT_CHANGE_ASPECTS,
  createFirstAssessmentEntryVersion,
  createSupersedingAssessmentEntryVersion,
  type AssessmentEntryVersion,
} from "./assessment-entry-versions";
import { assessmentConfigurations } from "./assessment-fixtures";
import { projectAssessmentPeriod, type ProjectAssessmentPeriodInput } from "./assessment-period-projection";
import { CORRECTED_RESULT_NOTE, presentPeriodCell } from "./assessment-period-presentation";
import { AssessmentPeriodWorkspace } from "./assessment-period-workspace";
import type { AcademicPlacement, AssessmentInstrument } from "./assessment-types";

const demo = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const config = { ...demo, pendingRuleIds: [] };
const pl = (studentId: string): AcademicPlacement => ({
  participationNature: "regular", studentId, enrollmentId: "e", unitId: "u", academicLinkId: "l",
  participationId: "p", allocationId: "a", classId: "c1", from: "2026-02-01", until: null,
});
const inst = { id: "i1", configurationId: config.id, periodId: "p1", pedagogicalAssignmentId: "at", classId: "c1", instrumentTypeId: "it-atividade", title: "Prova Bimestral", appliedOn: "2026-03-10", snapshot: {} } as AssessmentInstrument;
const act = { actedAt: "2026-03-12T00:00:00Z", agentId: "x", policyId: "p", policyVersion: 1, policyLabel: "P", satisfiedRequirements: [], changedAspects: [ASSESSMENT_CHANGE_ASPECTS.value] };
const v1 = (s: string, value: number) =>
  createFirstAssessmentEntryVersion({ versionId: `v1-${s}`, instrumentId: "i1", studentId: s, placement: { enrollmentId: "e", academicLinkId: "l", participationId: "p", allocationId: "a" }, value: { kind: "numerica", value }, status: "registrado", recordedByAssignmentId: "at", now: "2026-03-11T00:00:00Z" });
const next = (base: AssessmentEntryVersion, id: string, value: number) =>
  createSupersedingAssessmentEntryVersion({ base, versionId: id, value: { kind: "numerica", value }, rectification: act, now: "2026-03-12T00:00:00Z" });

const a1 = v1("s1", 70);
const b1 = v1("s2", 55);
const b2 = next(b1, "v2-s2", 65);
const c1 = v1("s3", 40);
const c2 = next(c1, "v2-s3", 45);
const c3 = next(c2, "v3-s3", 50);
const versions = [a1, b1, b2, c1, c2, c3];

const input = (over: Partial<ProjectAssessmentPeriodInput> = {}): ProjectAssessmentPeriodInput => ({
  context: { classId: "c1" },
  period: { id: "p1", label: "Período 1" },
  configuration: config,
  compositionModel: compositionModels[0]!,
  instruments: [inst],
  students: [
    { studentId: "s1", displayName: "Ana Souza", rollNumber: 1, placements: [pl("s1")] },
    { studentId: "s2", displayName: "Rafael Nunes", rollNumber: 2, placements: [pl("s2")] },
    { studentId: "s3", displayName: "Caio Rocha", rollNumber: 3, placements: [pl("s3")] },
  ],
  versions,
  agent: { agentId: "x", capabilities: [] },
  actionDefinitions: [{ actionId: "corrigir", label: "Corrigir", target: "result", requiredCapabilities: [], admissibleCellStates: ["recorded"] }],
  ...over,
});

const cellOf = (studentId: string, over: Partial<ProjectAssessmentPeriodInput> = {}) => {
  const p = projectAssessmentPeriod(input(over));
  if (p.state !== "period-available") throw new Error("indisponível");
  return p.students.find((s) => s.studentId === studentId)!.cells[0]!;
};

describe("resultado corrigido é derivado da cadeia", () => {
  it("v1 comum não recebe 'Resultado corrigido'", () => {
    expect(presentPeriodCell(cellOf("s1")).revisionNote).toBeUndefined();
  });
  it("versão vigente que substitui outra recebe 'Resultado corrigido'", () => {
    const c = cellOf("s2");
    expect(c.supersedesVersionId).toBe(b1.id);
    expect(presentPeriodCell(c)).toMatchObject({ label: "65", revisionNote: CORRECTED_RESULT_NOTE });
  });
  it("v3 recebe a mesma apresentação humana, sem novo estado de domínio", () => {
    const c = cellOf("s3");
    expect(c.state).toBe("recorded");
    expect(c.currentVersionNumber).toBe(3);
    expect(presentPeriodCell(c).revisionNote).toBe(CORRECTED_RESULT_NOTE);
  });
  it("valor protegido não revela correção nem valor", () => {
    const c = cellOf("s2", { valueReadCapability: "cap-x" });
    expect(c.supersedesVersionId).toBeUndefined();
    expect(presentPeriodCell(c)).toEqual({ label: "Valor protegido", tone: "protected" });
  });
  it("a cadeia permanece byte a byte inalterada pela apresentação", () => {
    const before = JSON.stringify(versions);
    const p = projectAssessmentPeriod(input());
    if (p.state === "period-available") p.students.forEach((s) => s.cells.forEach((c) => presentPeriodCell(c)));
    expect(JSON.stringify(versions)).toBe(before);
  });
});

describe("nome acessível de Corrigir", () => {
  it("contém estudante e instrumento; texto visual continua curto", () => {
    const p = projectAssessmentPeriod(input());
    if (p.state !== "period-available") throw new Error("indisponível");
    render(<AssessmentPeriodWorkspace projection={p} renderOpenPauta={() => null} onRequestCorrection={() => {}} renderCorrection={() => null} />);
    const buttons = screen.getAllByRole("button", { name: "Corrigir resultado de Rafael Nunes em Prova Bimestral" });
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0]!.textContent).toBe("Corrigir");
    expect(screen.getAllByText(/Resultado corrigido/).length).toBeGreaterThan(0);
  });
});
