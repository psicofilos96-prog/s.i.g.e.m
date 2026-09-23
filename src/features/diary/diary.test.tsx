import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AcademicContextSelector, FutureFeatureState } from "./diary-context";
import {
  DIARY_REFERENCE_DATE,
  assignmentActiveOn,
  diaryContext,
  diaryScenarios,
  diaryStageForClass,
  studentsForClassOn,
  taughtLessons,
} from "./diary-data";

describe("projeção contextual do Diário Inteligente", () => {
  it("oferece os quinze cenários fictícios requeridos", () =>
    expect(diaryScenarios).toHaveLength(15));
  it("consolida várias turmas para o professor padrão", () =>
    expect(diaryContext().assignments.length).toBeGreaterThan(1));
  it("preserva mais de um componente no contexto", () =>
    expect(diaryContext().fields.length).toBeGreaterThan(1));
  it("representa professor sem turma ativa", () =>
    expect(diaryContext("pro-011").assignments).toHaveLength(0));
  it("respeita início e fim da atuação", () => {
    expect(
      assignmentActiveOn({ start: "2026-05-04", end: "2026-06-30" } as never, "2026-05-20"),
    ).toBe(true);
    expect(
      assignmentActiveOn({ start: "2026-05-04", end: "2026-06-30" } as never, "2026-09-23"),
    ).toBe(false);
  });
  it("inclui o substituto somente dentro da vigência", () => {
    expect(diaryContext("pro-009", "2026-06-12").assignments).toHaveLength(1);
    expect(diaryContext("pro-009", DIARY_REFERENCE_DATE).assignments).toHaveLength(0);
  });
  it("recupera a atuação histórica sem apresentá-la hoje", () => {
    expect(
      diaryContext("pro-006", "2025-10-14").assignments.some((item) => item.classId === "tur-006"),
    ).toBe(true);
    expect(diaryContext("pro-006").assignments.some((item) => item.classId === "tur-006")).toBe(
      false,
    );
  });
  it("distingue Educação Infantil", () =>
    expect(diaryStageForClass("tur-002")).toBe("Educação Infantil"));
  it("distingue Anos Iniciais", () => expect(diaryStageForClass("tur-001")).toBe("Anos Iniciais"));
  it("distingue Anos Finais", () => expect(diaryStageForClass("tur-005")).toBe("Anos Finais"));
  it("distingue EJA", () => expect(diaryStageForClass("tur-004")).toBe("EJA"));
  it("lista apenas alunos alocados na turma e data", () => {
    expect(studentsForClassOn("tur-001", "2026-03-01").map((item) => item.student.id)).toEqual(
      expect.arrayContaining(["alu-001", "alu-002", "alu-005"]),
    );
    expect(
      studentsForClassOn("tur-001", "2026-09-23").map((item) => item.student.id),
    ).not.toContain("alu-005");
  });
  it("acompanha a mudança de turma por data", () => {
    expect(
      studentsForClassOn("tur-001", "2026-03-10").some((item) => item.student.id === "alu-005"),
    ).toBe(true);
    expect(
      studentsForClassOn("tur-009", "2026-03-24").some((item) => item.student.id === "alu-005"),
    ).toBe(true);
  });
  it("preserva aulas ministradas como registros próprios", () =>
    expect(taughtLessons.every((item) => item.status === "Registrada demonstrativamente")).toBe(
      true,
    ));
});

describe("controles reutilizáveis", () => {
  it("troca a data de referência com rótulo acessível", () => {
    const changes: unknown[] = [];
    const context = diaryContext();
    render(
      <AcademicContextSelector
        context={context}
        search={{}}
        onChange={(value) => changes.push(value)}
      />,
    );
    fireEvent.change(screen.getByLabelText("Data de referência"), {
      target: { value: "2025-10-14" },
    });
    expect(changes).toContainEqual({ data: "2025-10-14" });
  });
  it("identifica funcionalidades futuras sem ação falsa", () => {
    render(<FutureFeatureState title="Frequência" description="Ainda não implementada." />);
    expect(screen.getByText("Frequência")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salvar|concluir/i })).not.toBeInTheDocument();
  });
});
