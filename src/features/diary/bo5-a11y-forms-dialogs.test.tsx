// BO.5 — a11y técnica: erros associados ao campo, bloqueio de dupla submissão e diálogos (foco/ESC/retorno).
import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { diaryContext } from "./diary-data";
import { LessonRecordForm } from "./lesson-record-form";
import { emptyLessonInput, plannedLessonsFor } from "./lesson-records";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

function Harness({ onConclude }: { onConclude: () => void | Promise<void> }) {
  const ctx = diaryContext("pro-006", "2026-09-21");
  const [value, setValue] = useState(emptyLessonInput("pro-006", "2026-09-21", ctx.assignments[0]?.record.id));
  return <LessonRecordForm assignments={ctx.assignments} planned={plannedLessonsFor("pro-006", "2026-09-21")} value={value}
    onChange={setValue} onKeepDraft={() => {}} onConclude={onConclude} onDiscard={() => {}} hasDraft={false} />;
}

describe("BO.5 — erros de formulário associados", () => {
  it("campo com erro tem aria-invalid e aria-describedby apontando a mensagem perceptível", () => {
    render(<Harness onConclude={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Aula prevista 07:20–08:10/));
    fireEvent.change(screen.getByLabelText("Quantidade efetivamente realizada"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar registro" }));
    const content = screen.getByLabelText("Conteúdo ou atividade realizada");
    expect(content).toHaveAttribute("aria-invalid", "true");
    const ids = (content.getAttribute("aria-describedby") ?? "").split(" ");
    const msg = document.getElementById(ids[0]!);
    expect(msg).not.toBeNull();
    expect(msg).toHaveAttribute("role", "alert");
    expect(msg!.textContent!.length).toBeGreaterThan(5);
  });
  it("sem erro, sem aria-invalid", () => {
    render(<Harness onConclude={() => {}} />);
    expect(screen.getByLabelText("Quantidade efetivamente realizada")).not.toHaveAttribute("aria-invalid");
  });
});

describe("BO.5 — dupla submissão", () => {
  it("segunda ativação é ignorada enquanto a conclusão está pendente", async () => {
    let calls = 0; let release!: () => void;
    render(<Harness onConclude={() => { calls++; return new Promise<void>((r) => { release = r; }); }} />);
    fireEvent.click(screen.getByLabelText(/Aula prevista 07:20–08:10/));
    fireEvent.change(screen.getByLabelText("Conteúdo ou atividade realizada"), { target: { value: "Leitura" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar registro" }));
    const btn = within(screen.getByRole("region", { name: "Confirmação" })).getByRole("button", { name: /Concluir registro/ });
    fireEvent.click(btn); fireEvent.click(btn); fireEvent.click(btn);
    expect(calls).toBe(1);
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    await act(async () => { release(); });
    expect(btn).not.toBeDisabled();
  });
});

describe("BO.5 — diálogos", () => {
  it("Dialog: nome/descrição, foco inicial interno, ESC fecha e foco volta ao disparador", async () => {
    render(<Dialog><DialogTrigger>Abrir detalhes</DialogTrigger><DialogContent><DialogTitle>Detalhes da turma</DialogTitle>
      <DialogDescription>Resumo somente leitura.</DialogDescription><button>Ação interna</button></DialogContent></Dialog>);
    const trigger = screen.getByRole("button", { name: "Abrir detalhes" });
    trigger.focus(); fireEvent.click(trigger);
    const dlg = await screen.findByRole("dialog", { name: "Detalhes da turma" });
    expect(dlg).toHaveAccessibleDescription("Resumo somente leitura.");
    expect(dlg.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it("AlertDialog (ação destrutiva): foco inicial interno, ESC cancela e foco volta", async () => {
    render(<AlertDialog><AlertDialogTrigger>Encerrar atuação</AlertDialogTrigger><AlertDialogContent>
      <AlertDialogTitle>Confirmar encerramento</AlertDialogTitle><AlertDialogDescription>Ato irreversível.</AlertDialogDescription>
      <AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction>Encerrar</AlertDialogAction></AlertDialogContent></AlertDialog>);
    const trigger = screen.getByRole("button", { name: "Encerrar atuação" });
    trigger.focus(); fireEvent.click(trigger);
    const dlg = await screen.findByRole("alertdialog", { name: "Confirmar encerramento" });
    expect(dlg).toHaveAccessibleDescription("Ato irreversível.");
    expect(dlg.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
