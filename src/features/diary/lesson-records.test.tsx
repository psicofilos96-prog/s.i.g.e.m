import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { diaryContext, taughtLessons } from "./diary-data";
import { DraftIndicator, LessonRecordForm } from "./lesson-record-form";
import {
  allFixtureLessons,
  areConsecutive,
  dailyAgenda,
  emptyLessonInput,
  findLessonEntry,
  isInputDirty,
  lessonEntries,
  lessonScenarios,
  localLessonStore,
  plannedContentFor,
  plannedContents,
  plannedLessonsFor,
  selectionConflict,
  validateLessonInput,
  weekdayOf,
  type LessonRecordInput,
} from "./lesson-records";

afterEach(() => localLessonStore.reset());

const complete = (changes: Partial<LessonRecordInput> = {}): LessonRecordInput => ({
  ...emptyLessonInput("pro-006", "2026-09-21", "atp-001"),
  blockIds: ["bl-001"],
  quantity: 1,
  contents: { shared: "Conteúdo" },
  ...changes,
});

describe("aulas previstas e agenda", () => {
  it("calcula o dia da semana da data", () => {
    expect(weekdayOf("2026-09-23")).toBe("wed");
    expect(weekdayOf("2026-09-27")).toBeNull();
  });
  it("lista aulas previstas do dia apenas das atuações vigentes", () => {
    expect(plannedLessonsFor("pro-006", "2026-09-23").map((p) => p.blockId)).toEqual(["bl-006"]);
    expect(plannedLessonsFor("pro-006", "2026-09-21").map((p) => p.blockId)).toEqual([
      "bl-001",
      "bl-002",
      "bl-004",
    ]);
  });
  it("não oferece aulas ao substituto fora da vigência", () => {
    expect(plannedLessonsFor("pro-009", "2026-06-11")).toHaveLength(1);
    expect(plannedLessonsFor("pro-009", "2026-09-24")).toHaveLength(0);
  });
  it("reúne duas escolas na agenda do professor", () => {
    const units = new Set(plannedLessonsFor("pro-003", "2026-09-21").map((p) => p.unitId));
    expect(units.size).toBeGreaterThan(1);
  });
  it("não marca aula como realizada só porque a data passou", () => {
    const agenda = dailyAgenda("pro-006", "2026-09-21", []);
    expect(agenda.find((item) => item.blockId === "bl-004")?.state).toBe("Prevista");
    expect(agenda.find((item) => item.blockId === "bl-001")?.state).toBe("Registrada");
  });
  it("mostra rascunho local como em elaboração", () => {
    const draft = localLessonStore.upsert(
      complete({ date: "2026-09-23", blockIds: ["bl-006"] }),
      "Rascunho local",
    );
    const agenda = dailyAgenda("pro-006", "2026-09-23", localLessonStore.list());
    expect(agenda[0]).toMatchObject({ state: "Rascunho em elaboração", entryId: draft.id });
  });
  it("mantém planejamento separado e vinculado ao bloco e data", () => {
    expect(plannedContentFor("2026-09-23", "bl-006", "atp-001")?.id).toBe("pla-001");
    expect(plannedContentFor("2026-09-23", "bl-006", "atp-004")).toBeUndefined();
    expect(allFixtureLessons.some((l) => plannedContents.some((p) => p.id === l.id))).toBe(false);
  });
});

describe("seleção e validação", () => {
  const monday = plannedLessonsFor("pro-006", "2026-09-21");
  it("identifica aulas consecutivas e não consecutivas", () => {
    expect(areConsecutive(monday.slice(0, 2).map((p) => p.block))).toBe(true);
    expect(areConsecutive([monday[0]!.block, monday[2]!.block])).toBe(false);
  });
  it("bloqueia seleção de turmas diferentes", () => {
    const tuesday = plannedLessonsFor("pro-006", "2026-09-22");
    expect(selectionConflict(tuesday, ["bl-005", "bl-090"])?.kind).toBe("classes");
  });
  it("aceita registro simples completo", () =>
    expect(validateLessonInput(complete(), monday)).toEqual([]));
  it("exige conteúdo por aula quando individualizado", () => {
    const issues = validateLessonInput(
      complete({
        blockIds: ["bl-001", "bl-002"],
        quantity: 2,
        contentMode: "individual",
        contents: { "bl-001": "A" },
      }),
      monday,
    );
    expect(issues.some((i) => i.field === "content")).toBe(true);
  });
  it("rejeita bloco de outra atuação", () => {
    const issues = validateLessonInput(complete({ blockIds: ["bl-007"] }), monday);
    expect(issues.some((i) => i.field === "blocks")).toBe(true);
  });
  it("rejeita atuação fora da vigência", () => {
    const issues = validateLessonInput(
      complete({ professionalId: "pro-009", assignmentId: "atp-010", date: "2026-09-24" }),
      [],
    );
    expect(issues.some((i) => i.field === "assignment")).toBe(true);
  });
  it("exige justificativa e horário na aula fora da previsão", () => {
    const base = complete({ extraordinary: true, blockIds: [] });
    expect(validateLessonInput(base, monday).map((i) => i.field)).toEqual(
      expect.arrayContaining(["justification", "time"]),
    );
    expect(
      validateLessonInput(
        { ...base, justification: "x", extraordinaryStart: "10:00", extraordinaryEnd: "10:50" },
        monday,
      ),
    ).toEqual([]);
  });
  it("não exige campos opcionais nem habilidades", () =>
    expect(validateLessonInput(complete({ skills: "" }), monday)).toEqual([]));
});

describe("estado local sem persistência falsa", () => {
  it("cria, edita e descarta rascunhos locais", () => {
    const draft = localLessonStore.upsert(complete(), "Rascunho local");
    localLessonStore.upsert(complete({ contents: { shared: "Novo" } }), "Rascunho local", draft.id);
    expect(localLessonStore.list()).toHaveLength(1);
    expect(localLessonStore.discard(draft.id)).toBe(true);
    expect(localLessonStore.list()).toHaveLength(0);
  });
  it("não sobrescreve registro concluído", () => {
    const done = localLessonStore.upsert(complete(), "Concluído localmente (demonstração)");
    expect(() => localLessonStore.upsert(complete(), "Rascunho local", done.id)).toThrow();
    expect(localLessonStore.discard(done.id)).toBe(false);
  });
  it("não altera fixtures históricas", () => {
    const before = JSON.stringify(taughtLessons);
    localLessonStore.upsert(complete(), "Concluído localmente (demonstração)");
    expect(JSON.stringify(taughtLessons)).toBe(before);
  });
  it("distingue dados fictícios de registros da sessão no histórico", () => {
    localLessonStore.upsert(complete(), "Concluído localmente (demonstração)");
    const origins = new Set(lessonEntries("pro-006", localLessonStore.list()).map((e) => e.origin));
    expect(origins).toEqual(new Set(["fixture", "local"]));
  });
  it("detecta alterações não concluídas", () => {
    const base = emptyLessonInput("pro-006", "2026-09-23");
    expect(isInputDirty(base, base)).toBe(false);
    expect(isInputDirty({ ...base, quantity: 1 }, base)).toBe(true);
  });
});

describe("histórico e detalhamento", () => {
  it("cobre os dezoito cenários", () => expect(lessonScenarios).toHaveLength(18));
  it("detalha conteúdos individualizados", () =>
    expect(findLessonEntry("aul-005", [])?.contentMode).toBe("individual"));
  it("preserva a atuação do substituto", () =>
    expect(findLessonEntry("aul-003", [])).toMatchObject({
      professionalId: "pro-009",
      assignmentId: "atp-010",
    }));
  it("representa aula fora da previsão", () =>
    expect(findLessonEntry("aul-006", [])?.extraordinary).toBeDefined());
  it("inclui EJA e Anos Finais", () => {
    expect(findLessonEntry("aul-008", [])?.classId).toBe("tur-004");
    expect(findLessonEntry("aul-007", [])?.classId).toBe("tur-005");
  });
});

function Harness({ date = "2026-09-21", professional = "pro-006" }) {
  const context = diaryContext(professional, date);
  const [value, setValue] = useState(
    emptyLessonInput(professional, date, context.assignments[0]?.record.id),
  );
  const [log, setLog] = useState<string[]>([]);
  return (
    <>
      <DraftIndicator
        dirty={isInputDirty(
          value,
          emptyLessonInput(professional, date, context.assignments[0]?.record.id),
        )}
      />
      <LessonRecordForm
        assignments={context.assignments}
        planned={plannedLessonsFor(professional, date)}
        value={value}
        onChange={setValue}
        onKeepDraft={() => setLog((l) => [...l, "draft"])}
        onConclude={() => setLog((l) => [...l, "conclude"])}
        onDiscard={() => setLog((l) => [...l, "discard"])}
        hasDraft={false}
      />
      <output data-testid="log">{log.join(",")}</output>
    </>
  );
}

describe("formulário de registro", () => {
  it("seleciona várias aulas e oferece individualização", () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText(/Aula prevista 07:20–08:10/));
    fireEvent.click(screen.getByLabelText(/Aula prevista 08:10–09:20/));
    expect(screen.getByText(/2 aulas selecionadas · consecutivas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Individualizar por aula/ }));
    expect(screen.getByLabelText("Conteúdo da aula 07:20–08:10")).toBeInTheDocument();
    expect(screen.getByLabelText("Conteúdo da aula 08:10–09:20")).toBeInTheDocument();
  });
  it("sinaliza alterações não concluídas", () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText(/Aula prevista 07:20–08:10/));
    expect(screen.getByText("Alterações não concluídas")).toBeInTheDocument();
  });
  it("usa planejamento só após confirmação explícita", () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText(/Aula prevista 07:20–08:10/));
    const field = screen.getByLabelText("Conteúdo ou atividade realizada") as HTMLTextAreaElement;
    expect(field.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Usar como ponto de partida" }));
    expect(field.value).toContain("Leitura compartilhada");
  });
  it("mostra conflito para seleção entre turmas", () => {
    render(<Harness date="2026-09-22" />);
    fireEvent.click(screen.getByLabelText(/Aula prevista 07:20–08:10/));
    fireEvent.click(screen.getByLabelText(/Aula prevista 07:30–09:00/));
    expect(screen.getByRole("alert")).toHaveTextContent(/turmas diferentes/);
  });
  it("revisa antes de concluir e não conclui com pendências", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar registro" }));
    expect(screen.queryByRole("button", { name: /Concluir registro/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Aula prevista 07:20–08:10/));
    fireEvent.change(screen.getByLabelText("Conteúdo ou atividade realizada"), {
      target: { value: "Leitura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar registro" }));
    const confirm = screen.getByRole("region", { name: "Confirmação" });
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Concluir registro demonstrativo" }),
    );
    expect(screen.getByTestId("log")).toHaveTextContent("conclude");
  });
  it("adapta rótulos para Educação Infantil", () => {
    render(<Harness date="2026-09-22" />);
    fireEvent.click(screen.getByRole("radio", { name: /Campo de experiência/ }));
    expect(screen.getByLabelText("Experiências e vivências realizadas")).toBeInTheDocument();
    expect(screen.queryByText(/nota|média|AV1/i)).not.toBeInTheDocument();
  });
  it("oferece fluxo de aula fora da previsão", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("switch", { name: "Aula fora da previsão" }));
    expect(screen.getByLabelText("Justificativa da aula fora da previsão")).toBeInTheDocument();
  });
  it("não anuncia salvamento permanente", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: /^salvar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manter rascunho nesta aba" })).toBeInTheDocument();
  });
  it("mostra estado vazio sem aulas previstas", () => {
    render(<Harness date="2026-09-26" />);
    expect(screen.getByText("Sem aulas previstas nesta data")).toBeInTheDocument();
  });
});
