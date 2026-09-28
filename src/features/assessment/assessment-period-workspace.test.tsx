/** 6D.3.3.2 — testes da Mesa Avaliativa do Período. */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { compositionModels } from "./assessment-composition-fixtures";
import { createFirstAssessmentEntryVersion, createSupersedingAssessmentEntryVersion } from "./assessment-entry-versions";
import { assessmentConfigurations } from "./assessment-fixtures";
import { projectAssessmentPeriod, type ProjectAssessmentPeriodInput } from "./assessment-period-projection";
import { AssessmentPeriodWorkspace } from "./assessment-period-workspace";
import type { AcademicPlacement, AssessmentInstrument, EntryValue } from "./assessment-types";

const demo = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const config = { ...demo, pendingRuleIds: [] };
const model = compositionModels[0]!;
const pl = (studentId: string, from = "2026-02-01"): AcademicPlacement => ({
  participationNature: "regular", studentId, enrollmentId: "e", unitId: "u", academicLinkId: "l",
  participationId: "p", allocationId: "a", classId: "c1", from, until: null,
});
const inst = (id: string, t: string): AssessmentInstrument =>
  ({ id, configurationId: config.id, periodId: "p1", pedagogicalAssignmentId: "at", classId: "c1", instrumentTypeId: t, title: `Inst ${id}`, appliedOn: "2026-03-10", snapshot: {} }) as AssessmentInstrument;
const ver = (i: string, s: string, value: EntryValue) =>
  createFirstAssessmentEntryVersion({ versionId: `v-${i}-${s}`, instrumentId: i, studentId: s, placement: { enrollmentId: "e", academicLinkId: "l", participationId: "p", allocationId: "a" }, value, status: "registrado", recordedByAssignmentId: "at", now: "2026-03-11T00:00:00Z" });

const input = (over: Partial<ProjectAssessmentPeriodInput> = {}): ProjectAssessmentPeriodInput => ({
  context: { classId: "c1" },
  period: { id: "p1", label: "Período 1" },
  configuration: config,
  compositionModel: model,
  instruments: [inst("i1", "it-atividade")],
  students: [
    { studentId: "s1", displayName: "Ana", rollNumber: 1, placements: [pl("s1")], identityDiscriminator: "Código 1" },
    { studentId: "s2", displayName: "Ana", rollNumber: 2, placements: [pl("s2")], identityDiscriminator: "Código 2" },
    { studentId: "s3", displayName: "Bruno", rollNumber: 3, placements: [pl("s3")] },
    { studentId: "s4", displayName: "Caio", rollNumber: 4, placements: [pl("s4", "2026-06-01")] },
  ],
  versions: [ver("i1", "s1", { kind: "numerica", value: 80 }), ver("i1", "s2", { kind: "nao-registrado", reason: "Afastamento" })],
  agent: { agentId: "x", capabilities: ["r"] },
  actionDefinitions: [
    { actionId: "abrir-pauta", label: "Abrir pauta", target: "instrument", requiredCapabilities: ["r"] },
    { actionId: "corrigir", label: "Corrigir", target: "result", requiredCapabilities: ["r"], admissibleCellStates: ["recorded"] },
  ],
  ...over,
});

const mount = (over: Partial<ProjectAssessmentPeriodInput> = {}, onCorrect = () => {}) => {
  const p = projectAssessmentPeriod(input(over));
  if (p.state !== "period-available") throw new Error("indisponível");
  return render(
    <AssessmentPeriodWorkspace
      projection={p}
      renderOpenPauta={(id, label) => <a href={`/pauta/${id}`}>{label}</a>}
      onRequestCorrection={onCorrect}
      renderCorrection={() => <p>painel</p>}
    />,
  );
};

describe("6D.3.3.2 — Mesa Avaliativa do Período", () => {
  it("apresenta os estados por extenso e nunca como zero ou campo editável", () => {
    mount();
    const m = screen.getByTestId("period-matrix");
    expect(within(m).getByTestId("period-cell-s1-i1").textContent).toContain("80");
    expect(within(m).getByTestId("period-cell-s2-i1").textContent).toContain("Não registrado");
    expect(within(m).getByTestId("period-cell-s3-i1").textContent).toContain("Sem resultado");
    expect(within(m).getByTestId("period-cell-s4-i1").textContent).toContain("Não se aplica");
    expect(within(m).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(m).getByTestId("period-cell-s3-i1").textContent).not.toContain("0");
  });

  it("mantém visível a linha não aplicável e mostra discriminador só em homônimos", () => {
    mount();
    expect(screen.getByTestId("period-row-s4")).toBeTruthy();
    expect(screen.getByTestId("period-row-s1").textContent).toContain("Código 1");
    expect(screen.getByTestId("period-row-s3").textContent).not.toContain("Código");
  });

  it("abre a pauta homologada com o instrumento correto", () => {
    mount();
    const link = within(screen.getByTestId("period-instrument-i1")).getByRole("link", { name: "Abrir pauta" });
    expect(link.getAttribute("href")).toBe("/pauta/i1");
  });

  it("Corrigir só aparece quando a projeção admite e encaminha para a correção focal", () => {
    const calls: string[] = [];
    mount({}, ((s: string, i: string) => calls.push(`${s}:${i}`)) as never);
    const m = screen.getByTestId("period-matrix");
    expect(within(within(m).getByTestId("period-cell-s3-i1")).queryByRole("button", { name: /Corrigir/ })).toBeNull();
    fireEvent.click(within(within(m).getByTestId("period-cell-s1-i1")).getByRole("button", { name: /Corrigir/ }));
    expect(calls).toEqual(["s1:i1"]);
  });

  it("cada Corrigir tem nome acessível com estudante e instrumento", () => {
    mount();
    const m = screen.getByTestId("period-matrix");
    expect(
      within(m).getByRole("button", { name: "Corrigir resultado de Ana em Inst i1" }),
    ).toBeTruthy();
  });

  it("ação sem capacidade fica inerte com motivo", () => {
    mount({ agent: { agentId: "x", capabilities: [] } });
    expect(screen.queryByRole("link", { name: "Abrir pauta" })).toBeNull();
    expect(screen.getByTestId("period-instrument-i1").textContent).toContain("indisponível");
  });

  it("valores protegidos não aparecem", () => {
    mount({ valueReadCapability: "ler" });
    const m = screen.getByTestId("period-matrix");
    expect(within(m).getByTestId("period-cell-s1-i1").textContent).toContain("Valor protegido");
    expect(m.textContent).not.toContain("80");
  });

  it("composição bloqueada é dita por extenso, sem número", () => {
    mount();
    expect(within(screen.getByTestId("period-matrix")).getByTestId("period-composition-s1").textContent).toContain("Ainda não é possível calcular");
  });

  it("busca filtra sem reordenar", () => {
    mount();
    fireEvent.change(screen.getByTestId("period-search"), { target: { value: "an" } });
    const rows = within(screen.getByTestId("period-matrix")).getAllByTestId(/period-row-/);
    expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual(["period-row-s1", "period-row-s2"]);
  });

  it("reprojeção mostra o novo fato após correção", () => {
    const { rerender } = mount();
    const p2 = projectAssessmentPeriod(input({ versions: [...input().versions, ver("i1", "s3", { kind: "numerica", value: 55 })] }));
    if (p2.state !== "period-available") throw new Error();
    rerender(<AssessmentPeriodWorkspace projection={p2} renderOpenPauta={() => null} onRequestCorrection={() => {}} renderCorrection={() => null} />);
    expect(within(screen.getByTestId("period-matrix")).getByTestId("period-cell-s3-i1").textContent).toContain("55");
  });

  it("distingue textualmente resultado corrigido, derivado da cadeia de versões", () => {
    const base = ver("i1", "s3", { kind: "numerica", value: 55 });
    const v2 = createSupersedingAssessmentEntryVersion({
      base,
      versionId: "v-i1-s3-2",
      value: { kind: "numerica", value: 65 },
      rectification: {
        reason: "Erro de transcrição",
        policyId: "pol-1",
        policyVersion: 1,
        actedByAssignmentId: "at",
        actedAt: "2026-03-12T00:00:00Z",
        changeAspects: ["value"],
      } as never,
      now: "2026-03-12T00:00:00Z",
    });
    mount({ versions: [...input().versions, base, v2] });
    const m = screen.getByTestId("period-matrix");
    const corrected = within(m).getByTestId("period-cell-s3-i1");
    expect(corrected.textContent).toContain("65");
    expect(corrected.textContent).toContain("Resultado corrigido");
    expect(within(m).getByTestId("period-cell-s1-i1").textContent).not.toContain("Resultado corrigido");
    fireEvent.click(within(corrected).getByText("Histórico"));
    expect(corrected.textContent).toContain("Versão vigente 2");
    // A cadeia permanece intacta: v1 continua idêntica após a projeção.
    expect(base.value).toEqual({ kind: "numerica", value: 55 });
    expect(base.version).toBe(1);
  });

  it("não afirma correção em valor protegido", () => {
    const base = ver("i1", "s3", { kind: "numerica", value: 55 });
    const v2 = createSupersedingAssessmentEntryVersion({
      base,
      versionId: "v-i1-s3-2",
      value: { kind: "numerica", value: 65 },
      rectification: {
        reason: "Erro de transcrição",
        policyId: "pol-1",
        policyVersion: 1,
        actedByAssignmentId: "at",
        actedAt: "2026-03-12T00:00:00Z",
        changeAspects: ["value"],
      } as never,
      now: "2026-03-12T00:00:00Z",
    });
    mount({ versions: [...input().versions, base, v2], valueReadCapability: "ler" });
    const cell = within(screen.getByTestId("period-matrix")).getByTestId("period-cell-s3-i1");
    expect(cell.textContent).toContain("Valor protegido");
    expect(cell.textContent).not.toContain("Resultado corrigido");
    expect(cell.textContent).not.toContain("Versão vigente");
  });
});
