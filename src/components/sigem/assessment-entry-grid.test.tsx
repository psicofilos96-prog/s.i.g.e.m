/**
 * 6D.3.2.2 — testes da pauta de lançamento (laboratório de rascunho).
 *
 * Critério de aceite: teclado contínuo nas três semânticas, validação sem
 * avanço indevido, `not-applicable` saltado, busca sem destruir rascunho,
 * desfazer, e — selo da etapa — nenhum fato oficial alterado.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  AssessmentEntryWorkspace,
  useAssessmentEntryDraft,
  useAssessmentEntryKeyboard,
  AssessmentEntryGrid,
} from "./assessment-entry-grid";
import {
  projectInstrumentEntryRoster,
  type InstrumentInputMode,
  type InstrumentRosterItemProjection,
  type MissingEntryPolicyProjection,
} from "@/features/assessment/assessment-entry-projection";
import { assessmentConfigurations } from "@/features/assessment/assessment-fixtures";
import type { AssessmentEntryVersion } from "@/features/assessment/assessment-entry-versions";
import type { AcademicPlacement } from "@/features/assessment/assessment-types";

const POLICY: MissingEntryPolicyProjection = {
  requiresReason: true,
  admissibleReasons: [{ id: "mot-ausencia", label: "Ausência na aplicação" }],
  allowsCustomReason: false,
};

const NUMERIC: InstrumentInputMode = {
  kind: "numerica",
  min: 0,
  max: 10,
  step: 0.5,
  allowsDecimals: true,
  formatLabel: "0 a 10",
};

const CONCEPTUAL: InstrumentInputMode = {
  kind: "conceitual",
  ordered: true,
  options: [
    { id: "cc-1", label: "Em construção", order: 1 },
    { id: "cc-2", label: "Consolidado", order: 2 },
  ],
};

const DESCRIPTIVE: InstrumentInputMode = {
  kind: "descritiva",
  placeholder: "Registro descritivo",
};

/** 36 estudantes; o 5º não é aplicável e o 2º tem fato oficial vigente. */
function buildRoster(count = 36): readonly InstrumentRosterItemProjection[] {
  return Array.from({ length: count }, (_, index) => {
    const studentId = `alu-${index + 1}`;
    const base = {
      studentId,
      displayName: index === 7 ? "Mariana Fictícia Demonstrativa" : `Estudante Fictício ${index + 1}`,
      rollNumber: index + 1,
    };
    if (index === 4) {
      return {
        ...base,
        entryState: "not-applicable" as const,
        admissibility: { eligible: false, blockerReason: "Sem vínculo na data de aplicação." },
      };
    }
    if (index === 1) {
      return {
        ...base,
        entryState: "recorded" as const,
        admissibility: { eligible: true },
        currentVersionId: "ver-oficial-2",
        currentValue: { kind: "numerica" as const, value: 7 },
        currentDisplayLabel: "7",
      };
    }
    return { ...base, entryState: "unrecorded" as const, admissibility: { eligible: true } };
  });
}

function renderWorkspace(mode: InstrumentInputMode) {
  return render(
    <AssessmentEntryWorkspace
      contextLabel="Instrumento demonstrativo · Turma demonstrativa"
      rosterItems={buildRoster()}
      mode={mode}
      policy={POLICY}
    />,
  );
}

describe("balanço e contexto da pauta", () => {
  it("exibir balanço em três dimensões sem falar em pendência", () => {
    renderWorkspace(NUMERIC);
    const bar = screen.getByTestId("assessment-entry-quick-bar");
    expect(bar.textContent).toContain("registrados");
    expect(bar.textContent).toContain("sem registro");
    expect(bar.textContent).toContain("não aplicáveis");
    expect(bar.textContent).not.toMatch(/pend/i);
    expect(bar.textContent).toMatch(/Nenhuma alteração local/);
  });

  it("manter linha não aplicável visível como contexto", () => {
    renderWorkspace(NUMERIC);
    const row = screen.getByTestId("assessment-row-alu-5");
    expect(row.getAttribute("data-entry-state")).toBe("not-applicable");
    expect(row.textContent).toContain("Sem vínculo na data de aplicação.");
    expect(screen.queryByTestId("assessment-numeric-alu-5")).toBeNull();
  });
});

describe("semântica numérica", () => {
  it("lançar com Enter, aceitar vírgula e avançar", () => {
    renderWorkspace(NUMERIC);
    const first = screen.getByTestId("assessment-numeric-alu-1");
    fireEvent.change(first, { target: { value: "7,5" } });
    fireEvent.keyDown(first, { key: "Enter" });
    expect(screen.getByTestId("assessment-row-alu-1").getAttribute("data-local-change")).toBe("sim");
    // alu-2 tem registro oficial: fica fora do caminho de digitação.
    expect(screen.queryByTestId("assessment-numeric-alu-2")).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("assessment-numeric-alu-3"));
  });

  it("manter foco e explicar quando o valor está fora da escala", () => {
    renderWorkspace(NUMERIC);
    const first = screen.getByTestId("assessment-numeric-alu-1");
    fireEvent.change(first, { target: { value: "99" } });
    fireEvent.keyDown(first, { key: "Enter" });
    expect(screen.getByRole("alert").textContent).toContain("fora da escala");
    expect(screen.getByTestId("assessment-row-alu-1").getAttribute("data-local-change")).toBe("nao");
    expect(document.activeElement).not.toBe(screen.getByTestId("assessment-numeric-alu-3"));
  });

  it("saltar a linha não aplicável na navegação vertical", () => {
    renderWorkspace(NUMERIC);
    const fourth = screen.getByTestId("assessment-numeric-alu-4");
    fireEvent.focus(fourth);
    fireEvent.keyDown(fourth, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByTestId("assessment-numeric-alu-6"));
  });

  it("retirar a célula das alterações quando volta ao valor oficial", () => {
    renderWorkspace(NUMERIC);
    fireEvent.click(screen.getByTestId("assessment-correct-alu-2"));
    const second = screen.getByTestId("assessment-numeric-alu-2");
    fireEvent.change(second, { target: { value: "8" } });
    fireEvent.keyDown(second, { key: "Enter" });
    expect(screen.getByTestId("assessment-row-alu-2").getAttribute("data-local-change")).toBe("sim");
    fireEvent.change(second, { target: { value: "7" } });
    fireEvent.keyDown(second, { key: "Enter" });
    expect(screen.getByTestId("assessment-row-alu-2").getAttribute("data-local-change")).toBe("nao");
  });

  it("desfazer a última alteração local", () => {
    renderWorkspace(NUMERIC);
    const first = screen.getByTestId("assessment-numeric-alu-1");
    fireEvent.change(first, { target: { value: "6" } });
    fireEvent.keyDown(first, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(screen.getByTestId("assessment-row-alu-1").getAttribute("data-local-change")).toBe("nao");
  });
});

describe("semântica conceitual", () => {
  it("navegar as opções com setas e confirmar com Enter", () => {
    renderWorkspace(CONCEPTUAL);
    const trigger = screen.getByTestId("assessment-conceptual-alu-1");
    fireEvent.focus(trigger);
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByTestId("assessment-row-alu-1").textContent).toContain("Consolidado");
    expect(document.activeElement).toBe(screen.getByTestId("assessment-conceptual-alu-3"));
  });

  it("usar letra apenas como busca incremental, nunca como significado", () => {
    renderWorkspace(CONCEPTUAL);
    const trigger = screen.getByTestId("assessment-conceptual-alu-1");
    fireEvent.focus(trigger);
    fireEvent.keyDown(trigger, { key: "c" });
    // Nenhum valor foi lançado só por digitar uma letra.
    expect(screen.getByTestId("assessment-row-alu-1").getAttribute("data-local-change")).toBe("nao");
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("navegar entre estudantes quando o seletor está fechado", () => {
    renderWorkspace(CONCEPTUAL);
    const fourth = screen.getByTestId("assessment-conceptual-alu-4");
    fireEvent.focus(fourth);
    fireEvent.keyDown(fourth, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByTestId("assessment-conceptual-alu-6"));
  });
});

describe("semântica descritiva — 6D.3.2.7 (lista nominal + editor focal)", () => {
  it("manter um único editor protagonista com 35 estudantes", () => {
    renderWorkspace(DESCRIPTIVE);
    expect(screen.getAllByLabelText(/Registro descritivo de /)).toHaveLength(1);
    expect(screen.getByTestId("assessment-descriptive-list")).toBeTruthy();
  });

  it("manter Enter como quebra de linha e Ctrl+Enter como conclusão com avanço", () => {
    renderWorkspace(DESCRIPTIVE);
    const area = screen.getByTestId("assessment-descriptive-alu-1");
    fireEvent.change(area, { target: { value: "Primeira linha" } });
    fireEvent.keyDown(area, { key: "Enter" });
    expect(
      screen.getByTestId("assessment-descriptive-list-item-alu-1").textContent,
    ).toContain("Sem registro oficial");
    fireEvent.keyDown(area, { key: "Enter", ctrlKey: true });
    expect(
      screen.getByTestId("assessment-descriptive-list-item-alu-1").textContent,
    ).toContain("Alteração local preparada");
    expect(document.activeElement).toBe(screen.getByTestId("assessment-descriptive-alu-3"));
  });

  it("manter o resultado oficial fora da sequência e exigir correção consciente", () => {
    renderWorkspace(DESCRIPTIVE);
    expect(screen.getByTestId("assessment-descriptive-list").textContent).toContain("Registrado: 7");
    const area = screen.getByTestId("assessment-descriptive-alu-1");
    fireEvent.change(area, { target: { value: "Registro demonstrativo" } });
    fireEvent.keyDown(area, { key: "Enter", ctrlKey: true });
    // alu-2 tem registro oficial: nunca é pousado pela navegação de lançamento.
    expect(document.activeElement).toBe(screen.getByTestId("assessment-descriptive-alu-3"));
    expect(screen.queryByTestId("assessment-descriptive-alu-2")).toBeNull();
  });

  it("navegar com Alt + setas e restaurar o rascunho ao retornar", () => {
    renderWorkspace(DESCRIPTIVE);
    fireEvent.click(screen.getByTestId("assessment-descriptive-list-item-alu-4"));
    const area = screen.getByTestId("assessment-descriptive-alu-4");
    fireEvent.change(area, { target: { value: "Observação demonstrativa" } });
    fireEvent.keyDown(area, { key: "ArrowDown", altKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("assessment-descriptive-alu-6"));
    fireEvent.click(screen.getByTestId("assessment-descriptive-list-item-alu-4"));
    expect((screen.getByTestId("assessment-descriptive-alu-4") as HTMLTextAreaElement).value).toBe(
      "Observação demonstrativa",
    );
  });

  it("saltar a linha não aplicável na sequência", () => {
    renderWorkspace(DESCRIPTIVE);
    fireEvent.click(screen.getByTestId("assessment-descriptive-list-item-alu-4"));
    fireEvent.keyDown(screen.getByTestId("assessment-descriptive-alu-4"), {
      key: "ArrowDown",
      altKey: true,
    });
    expect(document.activeElement).toBe(screen.getByTestId("assessment-descriptive-alu-6"));
  });

  it("abandonar a edição com Escape sem criar alteração nova", () => {
    renderWorkspace(DESCRIPTIVE);
    const area = screen.getByTestId("assessment-descriptive-alu-1");
    fireEvent.change(area, { target: { value: "Rascunho anterior" } });
    fireEvent.keyDown(area, { key: "Enter", ctrlKey: true });
    const next = screen.getByTestId("assessment-descriptive-alu-3");
    fireEvent.change(next, { target: { value: "Texto que não virará rascunho" } });
    fireEvent.keyDown(next, { key: "Escape" });
    expect((screen.getByTestId("assessment-descriptive-alu-3") as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect(
      screen.getByTestId("assessment-descriptive-list-item-alu-3").textContent,
    ).toContain("Sem registro oficial");
    // rascunho anterior de alu-1 permanece preservado
    expect(
      screen.getByTestId("assessment-descriptive-list-item-alu-1").textContent,
    ).toContain("Alteração local preparada");
  });

  it("desfazer a última alteração local com Ctrl+Z", () => {
    renderWorkspace(DESCRIPTIVE);
    const area = screen.getByTestId("assessment-descriptive-alu-1");
    fireEvent.change(area, { target: { value: "Para desfazer" } });
    fireEvent.keyDown(area, { key: "Enter", ctrlKey: true });
    expect(
      screen.getByTestId("assessment-descriptive-list-item-alu-1").textContent,
    ).toContain("Alteração local preparada");
    fireEvent.keyDown(screen.getByTestId("assessment-descriptive-alu-3"), {
      key: "z",
      ctrlKey: true,
    });
    expect(
      screen.getByTestId("assessment-descriptive-list-item-alu-1").textContent,
    ).toContain("Sem registro oficial");
  });

  it("recusar registro descritivo vazio", () => {
    renderWorkspace(DESCRIPTIVE);
    const area = screen.getByTestId("assessment-descriptive-alu-1");
    fireEvent.keyDown(area, { key: "Enter", ctrlKey: true });
    expect(screen.getByRole("alert").textContent).toContain("vazio");
  });

  it("anunciar o fim da pauta no último estudante sem abrir a conferência", () => {
    const onRequestReview = vi.fn();
    render(
      <AssessmentEntryWorkspace
        contextLabel="Instrumento demonstrativo · Turma demonstrativa"
        rosterItems={buildRoster()}
        mode={DESCRIPTIVE}
        policy={POLICY}
        onRequestReview={onRequestReview}
      />,
    );
    fireEvent.click(screen.getByTestId("assessment-descriptive-list-item-alu-36"));
    const area = screen.getByTestId("assessment-descriptive-alu-36");
    fireEvent.change(area, { target: { value: "Registro final demonstrativo" } });
    fireEvent.keyDown(area, { key: "Enter", ctrlKey: true });
    expect(screen.getByTestId("assessment-end-of-roster").textContent).toContain("Fim da pauta");
    expect(document.activeElement).toBe(screen.getByTestId("assessment-descriptive-alu-36"));
    expect(onRequestReview).not.toHaveBeenCalled(); // abrir a conferência é decisão da pessoa
    fireEvent.click(screen.getByTestId("assessment-review-from-end"));
    expect(onRequestReview).toHaveBeenCalledTimes(1);
  });

  it("não duplicar o parecer na linha nem no status global", () => {
    renderWorkspace(DESCRIPTIVE);
    const area = screen.getByTestId("assessment-descriptive-alu-1");
    fireEvent.change(area, {
      target: { value: "Parecer longo demonstrativo que não deve se repetir" },
    });
    fireEvent.keyDown(area, { key: "Enter", ctrlKey: true });
    const listText = screen.getByTestId("assessment-descriptive-list").textContent ?? "";
    expect(listText).toContain("Alteração local preparada");
    expect(listText).not.toContain("Parecer longo demonstrativo");
    const barText = screen.getByTestId("assessment-entry-quick-bar").textContent ?? "";
    expect(barText).toContain("Última alteração: Estudante Fictício 1");
    expect(barText).not.toContain("Parecer longo demonstrativo");
  });
});

describe("não registrado", () => {
  it("exigir motivo da política e não oferecer atalho universal", () => {
    renderWorkspace(NUMERIC);
    fireEvent.click(screen.getByTestId("assessment-row-more-alu-1"));
    fireEvent.click(screen.getByTestId("assessment-missing-alu-1"));
    fireEvent.click(screen.getByTestId("assessment-missing-confirm-alu-1"));
    expect(screen.getByRole("alert").textContent).toContain("Informe o motivo");
    fireEvent.click(screen.getByRole("button", { name: "Ausência na aplicação" }));
    fireEvent.click(screen.getByTestId("assessment-missing-confirm-alu-1"));
    expect(screen.getByTestId("assessment-row-alu-1").textContent).toContain(
      "lançamento local preparado",
    );
  });
});

describe("cenário misto: busca, não aplicáveis, oficiais e rascunhos", () => {
  it("preservar rascunho durante busca e manter a navegação coerente", () => {
    renderWorkspace(NUMERIC);
    const first = screen.getByTestId("assessment-numeric-alu-1");
    fireEvent.change(first, { target: { value: "9" } });
    fireEvent.keyDown(first, { key: "Enter" });

    fireEvent.change(screen.getByLabelText("Localizar estudante pelo nome"), {
      target: { value: "Mariana" },
    });
    expect(screen.queryByTestId("assessment-row-alu-1")).toBeNull();
    expect(screen.getByTestId("assessment-row-alu-8")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Limpar busca"));
    expect(screen.getByTestId("assessment-row-alu-1").getAttribute("data-local-change")).toBe("sim");
  });

  it("descartar todas as alterações locais como operação neutra", () => {
    renderWorkspace(NUMERIC);
    const first = screen.getByTestId("assessment-numeric-alu-1");
    fireEvent.change(first, { target: { value: "9" } });
    fireEvent.keyDown(first, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Descartar alterações locais" }));
    expect(screen.getByTestId("assessment-entry-quick-bar").textContent).toMatch(
      /Nenhuma alteração local/,
    );
  });

  it("não oferecer nenhuma ação de preenchimento coletivo de resultado", () => {
    renderWorkspace(NUMERIC);
    const labels = screen.getAllByRole("button").map((button) => button.textContent ?? "");
    expect(labels.some((label) => /preencher|todos|repetir/i.test(label))).toBe(false);
  });
});

describe("selo da 6D.3.2.2 — nenhum fato oficial alterado", () => {
  it("manter as versões oficiais idênticas após centenas de interações", () => {
    const configuration = assessmentConfigurations.find(
      (item) => item.id === "cfg-2026-quantitativa-demo",
    )!;
    const placements = (studentId: string): readonly AcademicPlacement[] => [
      {
        studentId,
        enrollmentId: `mat-${studentId}`,
        unitId: "uni-001",
        academicLinkId: `vin-${studentId}`,
        participationId: `par-${studentId}`,
        participationNature: "regular",
        allocationId: `ent-${studentId}`,
        classId: "tur-001",
        from: "2026-02-01",
        until: null,
      },
    ];
    const versions: AssessmentEntryVersion[] = [
      {
        id: "ver-1",
        logicalEntryId: "ins-demo::alu-2",
        version: 1,
        instrumentId: "ins-demo",
        studentId: "alu-2",
        status: "registrado",
        value: { kind: "numerica", value: 70 },
        recordedAt: "2026-03-11T12:00:00.000Z",
        recordedBy: {
          professionalId: "pro-006",
          pedagogicalAssignmentId: "atp-001",
          displayName: "Profissional Fictício",
          at: "2026-03-11T12:00:00.000Z",
        },
      } as AssessmentEntryVersion,
    ];
    const before = JSON.stringify(versions);

    const projection = projectInstrumentEntryRoster({
      instrument: {
        id: "ins-demo",
        title: "Atividade demonstrativa",
        classId: "tur-001",
        appliedOn: "2026-03-10",
        periodId: "pa-2026-a1",
        instrumentTypeId: "it-atividade",
        configurationId: configuration.id,
      },
      configuration,
      students: Array.from({ length: 34 }, (_, index) => ({
        studentId: `alu-${index + 1}`,
        displayName: `Estudante Fictício ${index + 1}`,
        rollNumber: index + 1,
        placements: placements(`alu-${index + 1}`),
      })),
      versions,
    });
    expect(projection.state).toBe("entry-enabled");
    if (projection.state !== "entry-enabled") return;

    render(
      <AssessmentEntryWorkspace
        contextLabel="Atividade demonstrativa"
        rosterItems={projection.rosterItems}
        mode={projection.inputMode}
        policy={projection.missingEntryPolicy}
      />,
    );

    for (let index = 1; index <= 34; index += 1) {
      const cell = screen.queryByTestId(`assessment-numeric-alu-${index}`);
      if (!cell) continue; // registro oficial protegido
      fireEvent.change(cell, { target: { value: String((index % 100) + 1) } });
      fireEvent.keyDown(cell, { key: "Enter" });
      fireEvent.change(cell, { target: { value: "150" } });
      fireEvent.keyDown(cell, { key: "Enter" });
      fireEvent.keyDown(cell, { key: "ArrowUp" });
    }
    fireEvent.click(screen.getByRole("button", { name: "Descartar alterações locais" }));

    expect(JSON.stringify(versions)).toBe(before);
    expect(versions).toHaveLength(1);
  });
});

describe("contratos expostos", () => {
  it("exportar as primitivas do laboratório", () => {
    expect(typeof useAssessmentEntryDraft).toBe("function");
    expect(typeof useAssessmentEntryKeyboard).toBe("function");
    expect(typeof AssessmentEntryGrid).toBe("function");
  });
});
