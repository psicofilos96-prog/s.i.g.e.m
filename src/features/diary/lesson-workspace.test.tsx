import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  LessonWorkspace,
  lessonBlockGroup,
  lessonBlockGroups,
  mergeIndividualContent,
  splitSharedContent,
} from "./lesson-workspace";
import { emptyLessonInput, plannedLessonsFor, type LessonRecordInput } from "./lesson-records";

const planned = plannedLessonsFor("pro-006", "2026-09-21");
const group = lessonBlockGroup(planned, "bl-001")!;

function Harness({ onConclude = () => {} }: { onConclude?: () => void }) {
  const base: LessonRecordInput = {
    ...emptyLessonInput("pro-006", "2026-09-21", group[0]!.assignmentId),
    blockIds: group.map((item) => item.blockId),
    quantity: group.length,
  };
  const [value, setValue] = useState(base);
  return (
    <LessonWorkspace
      group={group}
      value={value}
      onChange={setValue}
      plans={[]}
      onConclude={onConclude}
    />
  );
}

describe("agrupamento de aulas contíguas", () => {
  it("reúne aulas consecutivas da mesma atuação em uma unidade pedagógica", () => {
    expect(group.map((item) => item.blockId)).toEqual(["bl-001", "bl-002"]);
  });
  it("mantém aula isolada como grupo próprio", () => {
    const groups = lessonBlockGroups(planned);
    expect(groups.some((item) => item.length === 1 && item[0]!.blockId === "bl-004")).toBe(true);
  });
});

describe("troca entre registro único e separado", () => {
  const value: LessonRecordInput = {
    ...emptyLessonInput("pro-006", "2026-09-21", "atp-001"),
    blockIds: ["bl-001", "bl-002"],
    quantity: 2,
    contents: { shared: "Frações" },
  };
  it("preserva o texto compartilhado ao separar por aula", () => {
    const next = splitSharedContent(value, ["bl-001", "bl-002"]);
    expect(next.contentMode).toBe("individual");
    expect(next.contents["bl-001"]).toBe("Frações");
    expect(next.contents["bl-002"]).toBe("Frações");
  });
  it("unifica sem perguntar quando os textos individuais coincidem", () => {
    const individual = splitSharedContent(value, ["bl-001", "bl-002"]);
    const result = mergeIndividualContent(individual, ["bl-001", "bl-002"]);
    expect(result.options).toBeUndefined();
    expect(result.value?.contents["shared"]).toBe("Frações");
  });
  it("pergunta o que preservar quando os textos divergem", () => {
    const divergent: LessonRecordInput = {
      ...value,
      contentMode: "individual",
      contents: { "bl-001": "Frações", "bl-002": "Problemas" },
    };
    const asked = mergeIndividualContent(divergent, ["bl-001", "bl-002"]);
    expect(asked.value).toBeUndefined();
    expect(asked.options).toEqual(["Frações", "Problemas"]);
    const joined = mergeIndividualContent(divergent, ["bl-001", "bl-002"], { kind: "join" });
    expect(joined.value?.contents["shared"]).toBe("Frações\n\nProblemas");
    const kept = mergeIndividualContent(divergent, ["bl-001", "bl-002"], {
      kind: "keep",
      text: "Problemas",
    });
    expect(kept.value?.contents["shared"]).toBe("Problemas");
    expect(kept.value?.contents["bl-002"]).toBe("Problemas");
  });
});

describe("ficha operacional de aula", () => {
  it("abre com o campo de escrita em foco e sem reconfirmar contexto", () => {
    render(<Harness />);
    const field = screen.getByLabelText("O que foi trabalhado nesta aula?");
    expect(field).toHaveFocus();
    expect(screen.queryByRole("radiogroup", { name: /Atuação/ })).toBeNull();
    expect(screen.getByText(/07:20–09:20/)).toBeInTheDocument();
  });

  it("conclui em um texto e uma confirmação curta, sem detalhe pedagógico", () => {
    const onConclude = vi.fn();
    render(<Harness onConclude={onConclude} />);
    fireEvent.change(screen.getByLabelText("O que foi trabalhado nesta aula?"), {
      target: { value: "Resolução de problemas envolvendo frações" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Concluir registro da aula" }));
    expect(screen.getByText("Concluir este registro?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Concluir registro" }));
    expect(onConclude).toHaveBeenCalledTimes(1);
  });

  it("não conclui sem o texto realizado", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Concluir registro da aula" })).toBeDisabled();
    expect(screen.getByText("Escreva o que foi trabalhado para concluir.")).toBeInTheDocument();
  });

  it("separa as aulas preservando o que já havia sido escrito", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("O que foi trabalhado nesta aula?"), {
      target: { value: "Frações" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Separar por aula/ }));
    const first = screen.getByLabelText(
      `O que foi trabalhado na aula de ${group[0]!.block.start}–${group[0]!.block.end}?`,
    ) as HTMLTextAreaElement;
    const second = screen.getByLabelText(
      `O que foi trabalhado na aula de ${group[1]!.block.start}–${group[1]!.block.end}?`,
    ) as HTMLTextAreaElement;
    expect(first.value).toBe("Frações");
    expect(second.value).toBe("Frações");
  });

  it("pergunta o que preservar antes de voltar ao registro único", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("O que foi trabalhado nesta aula?"), {
      target: { value: "Frações" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Separar por aula/ }));
    fireEvent.change(screen.getByLabelText(`O que foi trabalhado na aula de ${group[1]!.block.start}–${group[1]!.block.end}?`), {
      target: { value: "Problemas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Voltar a um registro único" }));
    expect(screen.getByText(/O que deseja preservar no registro único\?/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Manter os dois textos, um após o outro" }),
    );
    const field = screen.getByLabelText("O que foi trabalhado nesta aula?") as HTMLTextAreaElement;
    expect(field.value).toBe("Frações\n\nProblemas");
  });

  it("mantém detalhes pedagógicos recolhidos e opcionais", () => {
    render(<Harness />);
    expect(screen.queryByLabelText("Habilidades curriculares")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar detalhes pedagógicos/ }));
    expect(screen.getByLabelText("Habilidades curriculares")).toBeInTheDocument();
    expect(
      screen.getByText(/o registro se conclui apenas com o que foi trabalhado/),
    ).toBeInTheDocument();
  });

  it("copia o planejamento para o rascunho sem declarar realização", () => {
    function Planned() {
      const base: LessonRecordInput = {
        ...emptyLessonInput("pro-006", "2026-09-21", group[0]!.assignmentId),
        blockIds: group.map((item) => item.blockId),
        quantity: group.length,
      };
      const [value, setValue] = useState(base);
      return (
        <LessonWorkspace
          group={group}
          value={value}
          onChange={setValue}
          onConclude={() => {}}
          plans={[
            {
              id: "pla-003",
              date: "2026-09-21",
              blockId: "bl-001",
              assignmentId: "atp-001",
              text: "Leitura compartilhada de relato.",
              source: "Planejamento semanal demonstrativo",
            },
          ]}
        />
      );
    }
    render(<Planned />);
    const field = screen.getByLabelText("O que foi trabalhado nesta aula?") as HTMLTextAreaElement;
    expect(field.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Usar como ponto de partida" }));
    expect(field.value).toBe("Leitura compartilhada de relato.");
    expect(screen.getByText(/só passa a valer como realizado/)).toBeInTheDocument();
    expect(screen.getByText(/Planejado não é realizado/)).toBeInTheDocument();
  });

  it("descreve o rascunho como mantido apenas nesta sessão", () => {
    render(
      <LessonWorkspace
        group={group}
        value={{
          ...emptyLessonInput("pro-006", "2026-09-21", group[0]!.assignmentId),
          blockIds: group.map((item) => item.blockId),
          quantity: group.length,
        }}
        onChange={() => {}}
        onConclude={() => {}}
        plans={[]}
        dirty
      />,
    );
    expect(screen.getAllByText("Rascunho mantido nesta sessão").length).toBeGreaterThan(0);
  });
});
