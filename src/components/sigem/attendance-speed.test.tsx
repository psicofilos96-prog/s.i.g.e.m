/**
 * 6D.1.2 — testes das primitivas de alta velocidade da chamada.
 *
 * Critério de aceite: teclado contínuo funciona, lote + desfazer funciona,
 * busca não destrói contexto, alvos de toque são confortáveis e nenhuma
 * conveniência da interface cria fato institucional por conta própria.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  AttendanceQuickBar,
  AttendanceQuickSearch,
  AttendanceRow,
  filterSpeedRoster,
  speedHomonymIds,
  useSpeedDraft,
  useSpeedKeyboard,
  type SpeedMarkOption,
  type SpeedRosterPerson,
} from "./attendance-speed";
import { useState } from "react";

const MARKS: readonly SpeedMarkOption[] = [
  { value: "Presente", label: "Presente", shortLabel: "P", shortcut: "p" },
  { value: "Ausente", label: "Ausente", shortLabel: "F", shortcut: "f" },
];

const people: readonly SpeedRosterPerson[] = Array.from({ length: 30 }, (_, index) => ({
  id: `alu-${index + 1}`,
  order: index + 1,
  name:
    index === 4
      ? "Maria Fictícia Demonstrativa"
      : index === 9
        ? "Maria Fictícia Demonstrativa"
        : `Estudante Fictício ${index + 1}`,
  code: `SIGEM-${1000 + index}`,
}));

function Harness() {
  const [query, setQuery] = useState("");
  const draft = useSpeedDraft({ people, markOptions: MARKS });
  const visible = filterSpeedRoster(people, query);
  const homonyms = speedHomonymIds(people);
  const keyboard = useSpeedKeyboard({
    people: visible,
    markOptions: MARKS,
    onMark: draft.setMark,
    onClear: draft.clearMark,
  });
  return (
    <div>
      <AttendanceQuickBar
        balance={draft.balance}
        bulkMark={MARKS[0]}
        onBulkMark={() => draft.markUnmarkedAs("Presente")}
        onUndo={draft.undo}
        canUndo={draft.canUndo}
        lastOperationLabel={draft.lastOperationLabel}
      >
        <AttendanceQuickSearch
          value={query}
          onChange={setQuery}
          onSubmit={() => keyboard.focus(visible[0]?.id)}
          resultCount={visible.length}
        />
      </AttendanceQuickBar>
      <div role="table">
        {visible.map((person) => (
          <AttendanceRow
            key={person.id}
            person={person}
            mark={draft.marks[person.id]}
            markOptions={MARKS}
            showCode={query.trim().length >= 2 || homonyms.includes(person.id)}
            focused={keyboard.focusedId === person.id}
            onMark={(value) => draft.setMark(person.id, value)}
            onClear={() => draft.clearMark(person.id)}
            onFocus={() => keyboard.setFocusedId(person.id)}
            onKeyDown={keyboard.handleKeyDown(person.id)}
            rowRef={keyboard.registerRow(person.id)}
          />
        ))}
      </div>
    </div>
  );
}

const row = (id: string) => screen.getByTestId(`attendance-row-${id}`);
const balanceText = () => screen.getByTestId("attendance-quick-bar").textContent ?? "";

describe("balanço derivado do rascunho", () => {
  it("começa sem nenhuma marcação inferida", () => {
    render(<Harness />);
    expect(balanceText()).toContain("30 sem marcação");
    expect(balanceText()).toContain("0 presente");
  });

  it("nenhuma linha nasce marcada", () => {
    render(<Harness />);
    expect(row("alu-1").dataset["marked"]).toBe("nao");
  });
});

describe("chamada por exceção com lote explícito e desfazer", () => {
  it("marcar pendentes atinge apenas quem está sem marcação e é reversível", () => {
    render(<Harness />);
    fireEvent.click(
      within(row("alu-3")).getByRole("button", { name: /^Ausente/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Marcar pendentes como presente/ }));
    expect(balanceText()).toContain("29 presente");
    expect(balanceText()).toContain("1 ausente");
    expect(balanceText()).toContain("0 sem marcação");

    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(balanceText()).toContain("29 sem marcação");
    expect(balanceText()).toContain("1 ausente");
  });

  it("a ação em lote não fica disponível quando não há pendentes", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Marcar pendentes como presente/ }));
    expect(screen.getByRole("button", { name: /Marcar pendentes como presente/ })).toBeDisabled();
  });

  it("desfazer reverte também uma marcação individual", () => {
    render(<Harness />);
    fireEvent.click(within(row("alu-2")).getByRole("button", { name: /^Presente/ }));
    expect(row("alu-2").dataset["marked"]).toBe("sim");
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(row("alu-2").dataset["marked"]).toBe("nao");
  });

  it("tocar de novo na mesma marcação devolve a linha a sem marcação", () => {
    render(<Harness />);
    const target = within(row("alu-2")).getByRole("button", { name: /^Presente/ });
    fireEvent.click(target);
    fireEvent.click(within(row("alu-2")).getByRole("button", { name: /^Presente/ }));
    expect(row("alu-2").dataset["marked"]).toBe("nao");
    expect(balanceText()).toContain("30 sem marcação");
  });
});

describe("teclado contínuo", () => {
  it("setas movem o foco e P/F marcam avançando", () => {
    render(<Harness />);
    row("alu-1").focus();
    fireEvent.keyDown(row("alu-1"), { key: "p" });
    expect(row("alu-1").dataset["marked"]).toBe("sim");
    expect(document.activeElement).toBe(row("alu-2"));

    fireEvent.keyDown(row("alu-2"), { key: "f" });
    expect(balanceText()).toContain("1 presente");
    expect(balanceText()).toContain("1 ausente");
    expect(document.activeElement).toBe(row("alu-3"));

    fireEvent.keyDown(row("alu-3"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(row("alu-2"));
  });

  it("Delete limpa e mantém o foco na mesma pessoa, para remarcação imediata", () => {
    render(<Harness />);
    row("alu-1").focus();
    fireEvent.keyDown(row("alu-1"), { key: "p" });
    row("alu-1").focus();
    fireEvent.keyDown(row("alu-1"), { key: "Delete" });
    expect(row("alu-1").dataset["marked"]).toBe("nao");
    expect(document.activeElement).toBe(row("alu-1"));
  });

  it("o foco não sai da lista nos extremos", () => {
    render(<Harness />);
    row("alu-1").focus();
    fireEvent.keyDown(row("alu-1"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(row("alu-1"));
  });
});

describe("busca rápida preserva o contexto", () => {
  it("filtra sem perder marcações e volta à lista inteira ao limpar", () => {
    render(<Harness />);
    fireEvent.click(within(row("alu-1")).getByRole("button", { name: /^Presente/ }));
    fireEvent.change(screen.getByLabelText("Localizar estudante pelo nome"), {
      target: { value: "Fictício 7" },
    });
    expect(screen.queryByTestId("attendance-row-alu-1")).toBeNull();
    expect(balanceText()).toContain("1 presente");

    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(row("alu-1").dataset["marked"]).toBe("sim");
  });

  it("Enter leva o foco ao primeiro resultado", () => {
    render(<Harness />);
    const field = screen.getByLabelText("Localizar estudante pelo nome");
    fireEvent.change(field, { target: { value: "Fictício 12" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(document.activeElement).toBe(row("alu-12"));
  });

  it("menos de duas letras não filtra a lista habitual", () => {
    expect(filterSpeedRoster(people, "F")).toHaveLength(30);
    expect(filterSpeedRoster(people, "SIGEM-1000")).toHaveLength(1);
  });
});

describe("identificador sob demanda", () => {
  it("a lista habitual mostra número e nome, sem código", () => {
    render(<Harness />);
    expect(row("alu-1").textContent).not.toContain("SIGEM-1000");
  });

  it("homônimos na mesma turma exibem o código", () => {
    render(<Harness />);
    expect(speedHomonymIds(people)).toEqual(["alu-5", "alu-10"]);
    expect(row("alu-5").textContent).toContain("SIGEM-1004");
  });

  it("durante a busca o código aparece para desfazer dúvida", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Localizar estudante pelo nome"), {
      target: { value: "Fictício 7" },
    });
    expect(row("alu-7").textContent).toContain("SIGEM-1006");
  });
});

describe("primitivas agnósticas ao Diário", () => {
  it("não oferecem marcação que não tenha sido declarada", () => {
    render(
      <AttendanceRow
        person={{ id: "p1", order: 1, name: "Pessoa Fictícia" }}
        markOptions={[MARKS[0]!]}
        onMark={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^Presente/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ausente/ })).toBeNull();
  });

  it("sem marcação de lote declarada não existe ação em lote", () => {
    render(
      <AttendanceQuickBar
        balance={{ byMark: [{ value: "Presente", label: "Presente", count: 0 }], unmarked: 3, total: 3 }}
      />,
    );
    expect(screen.queryByRole("button", { name: /Marcar pendentes/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desfazer" })).toBeNull();
  });
});
