/**
 * 6D.3.2.3b — Conferência e Registro da Pauta. Cinco cenários de homologação.
 */
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AssessmentEntryRegistration, type AssessmentEntryFactSource } from "./assessment-entry-registration";
import type { AssessmentCorrectionPolicy } from "@/features/assessment/assessment-correction";
import type { AssessmentBatchOperation, AssessmentEntryBatchAct } from "@/features/assessment/assessment-entry-batch";
import type { InstrumentEntryRosterStudent } from "@/features/assessment/assessment-entry-projection";
import {
  createFirstAssessmentEntryVersion,
  createSupersedingAssessmentEntryVersion,
  type AssessmentEntryVersion,
} from "@/features/assessment/assessment-entry-versions";
import { assessmentConfigurations } from "@/features/assessment/assessment-fixtures";

const config = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const sid = (n: number) => `stu-${String(n).padStart(2, "0")}`;
const students: InstrumentEntryRosterStudent[] = Array.from({ length: 35 }, (_, i) => ({
  studentId: sid(i + 1),
  displayName: `Estudante ${i + 1}`,
  rollNumber: i + 1,
  placements: [{
    participationNature: "regular", studentId: sid(i + 1), enrollmentId: `enr-${i + 1}`, unitId: "un-1",
    academicLinkId: `lnk-${i + 1}`, participationId: `par-${i + 1}`, allocationId: `alo-${i + 1}`,
    classId: "cls-1", from: "2026-02-01", until: i >= 33 ? "2026-03-01" : null,
  }],
}));
const official = (n: number, value: number) =>
  createFirstAssessmentEntryVersion({
    versionId: `v1-${sid(n)}`, instrumentId: "ins-1", studentId: sid(n),
    placement: { enrollmentId: `enr-${n}`, academicLinkId: `lnk-${n}`, participationId: `par-${n}`, allocationId: `alo-${n}` },
    value: { kind: "numerica", value }, status: "registrado", recordedByAssignmentId: "atu-1",
    now: "2026-04-11T10:00:00.000Z",
  });
const policy: AssessmentCorrectionPolicy = {
  id: "pol-livre", version: 1, label: "Correção antes do fechamento", homologated: true,
  appliesWhenPeriodClosing: "absent", outcome: "admissible", requiredCapabilities: [],
  requirements: [{ code: "justificativa", label: "Justificativa da correção", provenance: "Regra pol-livre v1." }],
  disclosesNormativeContext: true,
};

function makeSource(initial: AssessmentEntryVersion[] = []) {
  const store = { versions: [...initial], acts: [] as AssessmentEntryBatchAct[], appends: 0 };
  const source: AssessmentEntryFactSource = {
    readRoster: () => ({
      instrument: { id: "ins-1", title: "Prova", classId: "cls-1", appliedOn: "2026-04-10", periodId: "per-1", instrumentTypeId: "it-prova", configurationId: config.id },
      configuration: config, students, versions: store.versions,
    }),
    readActs: () => store.acts,
    append: (versions, act) => { store.versions = [...store.versions, ...versions]; store.acts = [...store.acts, act]; store.appends += 1; },
  };
  return { store, source };
}
const idFor = (op: AssessmentBatchOperation) =>
  op.kind === "novo-registro" ? `v1-${op.studentId}` : `v${op.baseVersion + 1}-${op.studentId}`;

function mount(source: AssessmentEntryFactSource) {
  return render(
    <AssessmentEntryRegistration
      contextLabel="Prova · Turma"
      source={source}
      context={{ agent: { agentId: "prof-1", capabilities: [] }, recordedByAssignmentId: "atu-1", correctionPolicies: [policy], instrumentStatus: "aplicado" }}
      newVersionId={idFor}
      now={() => "2026-04-12T10:00:00.000Z"}
    />,
  );
}
function type(n: number, value: string) {
  const input = screen.getByTestId(`assessment-numeric-${sid(n)}`);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("6D.3.2.3b — conferência e registro", () => {
  it("registro normal de 33 alunos, com reprojeção a partir das novas versões", () => {
    const { store, source } = makeSource();
    mount(source);
    for (let n = 1; n <= 33; n += 1) type(n, String(50 + n));
    fireEvent.click(screen.getByTestId("assessment-review-open"));
    expect(store.versions).toHaveLength(0);
    expect(screen.getByTestId("assessment-review-summary").textContent).toContain("33 novos registros");
    fireEvent.click(screen.getByTestId("assessment-register"));
    expect(store.versions).toHaveLength(33);
    expect(screen.getByTestId("assessment-registration-success").textContent).toContain("33 novos resultados");
    expect(screen.getByTestId(`assessment-row-${sid(1)}`).getAttribute("data-local-change")).toBe("nao");
  });

  it("pauta parcialmente preenchida é registrável sem regra de completude", () => {
    const { store, source } = makeSource();
    mount(source);
    for (let n = 1; n <= 10; n += 1) type(n, "70");
    fireEvent.click(screen.getByTestId("assessment-review-open"));
    expect(screen.getByTestId("assessment-review-summary").textContent).toContain("23 estudantes continuam sem registro");
    fireEvent.click(screen.getByTestId("assessment-register"));
    expect(store.versions).toHaveLength(10);
  });

  it("retificação projeta o rito do resolvedor e só registra com ele cumprido", () => {
    const { store, source } = makeSource([official(1, 70)]);
    mount(source);
    type(1, "80");
    type(2, "60");
    fireEvent.click(screen.getByTestId("assessment-review-open"));
    const rect = screen.getByTestId(`assessment-rectification-${sid(1)}`);
    expect(rect.textContent).toContain("70 → 80");
    expect((screen.getByTestId("assessment-register") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId(`assessment-justification-${sid(1)}`), { target: { value: "Erro de digitação." } });
    fireEvent.click(screen.getByTestId("assessment-register"));
    expect(store.versions.filter((v) => v.studentId === sid(1))).toHaveLength(2);
    expect(screen.getByTestId("assessment-registration-success").textContent).toContain("1 correção");
  });

  it("conflito entre conferência e registro: zero registros parciais e rascunho preservado", () => {
    const { store, source } = makeSource([official(1, 70)]);
    mount(source);
    for (let n = 2; n <= 27; n += 1) type(n, "65");
    type(1, "80");
    fireEvent.click(screen.getByTestId("assessment-review-open"));
    fireEvent.change(screen.getByTestId(`assessment-justification-${sid(1)}`), { target: { value: "Revisão." } });
    // Outra sessão altera o estudante 1.
    act(() => {
      store.versions = [...store.versions, createSupersedingAssessmentEntryVersion({
        base: store.versions[0]!, versionId: "v2-externa", value: { kind: "numerica", value: 75 },
        recordedByAssignmentId: "atu-2", now: "2026-04-12T09:00:00.000Z",
      } as never)];
    });
    const before = store.versions.length;
    fireEvent.click(screen.getByTestId("assessment-register"));
    expect(store.versions).toHaveLength(before);
    expect(store.appends).toBe(0);
    expect(screen.getByTestId("assessment-registration-conflict").textContent).toContain("Nenhum lançamento foi registrado");
    fireEvent.click(screen.getByTestId("assessment-conflict-back"));
    expect(screen.getByTestId(`assessment-row-${sid(5)}`).getAttribute("data-local-change")).toBe("sim");
  });

  it("duplo clique em Registrar produz um único ato", () => {
    const { store, source } = makeSource();
    mount(source);
    for (let n = 1; n <= 5; n += 1) type(n, "70");
    fireEvent.click(screen.getByTestId("assessment-review-open"));
    const button = screen.getByTestId("assessment-register");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(store.acts).toHaveLength(1);
    expect(store.versions).toHaveLength(5);
  });
});
