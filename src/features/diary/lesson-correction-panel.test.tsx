import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LessonCorrectionPanel } from "./lesson-correction-panel";
import { lessonVersionStore } from "./lesson-correction-config";
import { findLessonEntry, type LessonEntry } from "./lesson-records";

const openEntry = findLessonEntry("aul-001", [])!; // 2026, sem fechamento oficial
const sharedText = "Leitura compartilhada e produção de pequenos relatos.";

function closedPeriodEntry(): LessonEntry {
  return { ...openEntry, id: "aul-001-2025", date: "2025-10-14" };
}

afterEach(() => lessonVersionStore.reset());

describe("6D.2.3 — retificação do registro de aula", () => {
  it("estado 1: correção simples, sem rito adicional", () => {
    render(<LessonCorrectionPanel entry={openEntry} />);
    fireEvent.click(screen.getByRole("button", { name: /Corrigir registro/ }));

    const field = screen.getByLabelText("O que foi trabalhado nesta aula?");
    expect(field).toHaveValue(sharedText);
    fireEvent.change(field, { target: { value: "Resolução de problemas com frações." } });

    fireEvent.click(screen.getByRole("button", { name: /Conferir correção/ }));
    expect(screen.getByText("Antes")).toBeInTheDocument();
    expect(screen.getByText("Depois")).toBeInTheDocument();
    expect(screen.queryByLabelText("Justificativa da correção")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Registrar correção" }));
    expect(screen.getByRole("status").textContent).toContain("preservado no histórico");
    expect(screen.getByText(/Versão 2/)).toBeInTheDocument();
  });

  it("estado 2: correção com requisito normativo projetado pela regra", () => {
    render(<LessonCorrectionPanel entry={closedPeriodEntry()} profileId="perfil-secretaria-escolar" />);
    fireEvent.click(screen.getByRole("button", { name: /Corrigir registro/ }));
    fireEvent.change(screen.getByLabelText("O que foi trabalhado nesta aula?"), {
      target: { value: "Texto corrigido do registro." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Conferir correção/ }));

    const justification = screen.getByLabelText("Justificativa da correção");
    expect(screen.getByRole("button", { name: "Registrar correção" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Por que é pedida?" }));
    expect(screen.getByText(/fechamento oficial vigente/)).toBeInTheDocument();

    fireEvent.change(justification, { target: { value: "Conteúdo lançado na aula errada." } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar correção" }));
    expect(screen.getByText(/Versão 2/)).toBeInTheDocument();
  });

  it("estado 3: correção impedida explica o motivo e o que faltaria", () => {
    render(<LessonCorrectionPanel entry={closedPeriodEntry()} profileId="perfil-docente" />);
    expect(screen.queryByRole("button", { name: /Corrigir registro/ })).toBeNull();
    expect(screen.getByText(/Por que não posso corrigir este registro agora\?/)).toBeInTheDocument();
    expect(screen.getByText(/O que teria de acontecer para ser possível\?/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("executar-retificacao-de-registro-de-aula");

    fireEvent.click(screen.getByRole("button", { name: "Detalhes normativos" }));
    expect(screen.getByText(/executar-retificacao-de-registro-de-aula/)).toBeInTheDocument();
  });

  it("estado 4: transformação entre registro conjunto e separado, em linguagem docente", () => {
    render(<LessonCorrectionPanel entry={openEntry} />);
    fireEvent.click(screen.getByRole("button", { name: /Corrigir registro/ }));
    fireEvent.click(screen.getByRole("button", { name: /Passar a um registro para cada aula/ }));

    expect(screen.getByLabelText(/O que foi trabalhado na 1ª aula deste registro\?/)).toHaveValue(
      sharedText,
    );
    fireEvent.change(screen.getByLabelText(/O que foi trabalhado na 2ª aula deste registro\?/), {
      target: { value: "Reescrita coletiva do relato." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Conferir correção/ }));
    expect(screen.getByText("Forma de registro das aulas")).toBeInTheDocument();
    expect(screen.getByText("Um registro para as aulas")).toBeInTheDocument();
    expect(screen.getByText("Um registro para cada aula")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("individual");

    fireEvent.click(screen.getByRole("button", { name: "Registrar correção" }));
    expect(screen.getByText(/Versão 2/)).toBeInTheDocument();
  });

  it("estado 5: nova correção parte da versão vigente, não da primeira", () => {
    render(<LessonCorrectionPanel entry={openEntry} />);
    fireEvent.click(screen.getByRole("button", { name: /Corrigir registro/ }));
    fireEvent.change(screen.getByLabelText("O que foi trabalhado nesta aula?"), {
      target: { value: "Primeira correção." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Conferir correção/ }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar correção" }));

    fireEvent.click(screen.getByRole("button", { name: /Corrigir registro/ }));
    expect(screen.getByLabelText("O que foi trabalhado nesta aula?")).toHaveValue(
      "Primeira correção.",
    );
    fireEvent.change(screen.getByLabelText("O que foi trabalhado nesta aula?"), {
      target: { value: "Segunda correção." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Conferir correção/ }));
    expect(screen.getByText("Primeira correção.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar correção" }));
    expect(screen.getByText(/Versão 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver histórico do registro/ }));
    expect(screen.getAllByText(/Registro anterior preservado/)).toHaveLength(2);
  });

  it("texto restaurado ao conteúdo vigente volta a “Nenhuma alteração para registrar”", () => {
    render(<LessonCorrectionPanel entry={openEntry} />);
    fireEvent.click(screen.getByRole("button", { name: /Corrigir registro/ }));
    const field = screen.getByLabelText("O que foi trabalhado nesta aula?");
    expect(screen.getByRole("status").textContent).toContain("Nenhuma alteração para registrar");

    fireEvent.change(field, { target: { value: "Texto diferente." } });
    expect(screen.getByRole("button", { name: /Conferir correção/ })).toBeEnabled();

    fireEvent.change(field, { target: { value: sharedText } });
    expect(screen.getByRole("status").textContent).toContain("Nenhuma alteração para registrar");
    expect(screen.getByRole("button", { name: /Conferir correção/ })).toBeDisabled();
  });
});
