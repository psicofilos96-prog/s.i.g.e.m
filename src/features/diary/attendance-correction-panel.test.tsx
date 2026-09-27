/** 6D.1.4 — retificação humana projetada do Attendance Correction Resolver. */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { attendanceStore } from "./attendance";
import { AttendanceCorrectionPanel, effectiveChanges } from "./attendance-correction-panel";
import type { PeriodAttendanceClosingRecord } from "./attendance-closing-types";
import { findLessonEntry } from "./lesson-records";

afterEach(() => attendanceStore.reset());

const entry = findLessonEntry("aul-001", [])!;
const teacher = { id: "p", name: "Prof", profileLabel: "Professor", capabilities: [] };
const secretary = { ...teacher, id: "s", capabilities: ["executar-retificacao-de-frequencia" as const] };
const closing = {
  id: "fec-x",
  version: 1,
  scope: {
    classId: entry.classId,
    academicYearId: "ano-2026",
    periodId: "per-1",
    accountingUnit: { kind: "componente-ou-campo", id: "x", label: "X" },
  },
  periodLabel: "1º período",
  lessonEntryIds: [entry.id],
} as unknown as PeriodAttendanceClosingRecord;

function mount(actor = teacher, closings: PeriodAttendanceClosingRecord[] = [], op = entry.professionalId) {
  const record = attendanceStore.get(entry.id)!;
  return render(
    <AttendanceCorrectionPanel
      entry={entry}
      record={record}
      actor={actor}
      operatingProfessionalId={op}
      closings={closings}
    />,
  );
}

const open = () => fireEvent.click(screen.getByRole("button", { name: /Corrigir chamada/ }));
const pickFirst = () => {
  const list = screen.getAllByRole("list")[0]!;
  fireEvent.click(within(list).getAllByRole("button")[1]!); // Aula 1 · alu-002 (Presente)
};

describe("retificação da chamada (6D.1.4)", () => {
  it("correção sem rito adicional produz versão 2 e preserva a anterior", () => {
    mount();
    open();
    expect(screen.queryByText(/Justificativa/)).toBeNull();
    pickFirst();
    fireEvent.click(screen.getByRole("button", { name: "Ausente" }));
    fireEvent.click(screen.getByRole("button", { name: "Conferir correção" }));
    expect(screen.getByText(/Presente →/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Registrar correção/ }));
    const current = attendanceStore.get(entry.id)!;
    expect(current.version).toBe(2);
    expect(current.marks["bl-001"]?.["alu-002"]).toBe("Ausente");
    expect(attendanceStore.history(entry.id)[0]?.marks["bl-001"]?.["alu-002"]).toBe("Presente");
    expect(screen.getByRole("status").textContent).toMatch(/preservada no histórico/);
  });

  it("mesma marcação não gera falsa nova versão", () => {
    mount();
    open();
    pickFirst();
    fireEvent.click(screen.getByRole("button", { name: "Presente" }));
    expect(screen.getByRole("button", { name: "Conferir correção" })).toHaveProperty("disabled", true);
    expect(effectiveChanges(attendanceStore.get(entry.id)!, { "bl-001::alu-002": "Presente" })).toEqual([]);
  });

  it("fechamento vigente sem capacidade falha fechada", () => {
    mount(teacher, [closing]);
    open();
    expect(screen.getByText(/não pode ser corrigida aqui/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conferir correção" })).toBeNull();
  });

  it("atuação de outro profissional falha fechada", () => {
    mount(teacher, [], "pro-outro");
    open();
    expect(screen.getByText(/não pode ser corrigida aqui/)).toBeTruthy();
  });

  it("justificativa exigida pela regra é pedida e registrada", () => {
    mount(secretary, [closing]);
    open();
    pickFirst();
    fireEvent.click(screen.getByRole("button", { name: "Ausente" }));
    const review = screen.getByRole("button", { name: "Conferir correção" });
    expect(review).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Erro de digitação" } });
    fireEvent.click(review);
    fireEvent.click(screen.getByRole("button", { name: /Registrar correção/ }));
    expect(attendanceStore.get(entry.id)!.rectification?.justification).toBe("Erro de digitação");
  });

  it("versão já retificada: opera sobre a marcação vigente", () => {
    const base = attendanceStore.get(entry.id)!;
    attendanceStore.rectify(
      entry.id,
      { ...base.marks, "bl-001": { ...base.marks["bl-001"], "alu-002": "Ausente" } },
      { at: "x", actorId: "p", actorName: "Prof", changes: [] },
    );
    mount();
    open();
    expect(screen.getByText(/versão 2/)).toBeTruthy();
    pickFirst();
    expect(screen.getByText(/Registrado:/).textContent).toMatch(/Ausente/);
  });
});
