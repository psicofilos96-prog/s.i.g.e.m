import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssignmentBoard } from "./assignment-board";
import { buildBoard, makeIntent, submitState, totals } from "./assignment-board-model";
import type { NeedLine } from "./teacher-need-engine";

const nl = (o: Partial<NeedLine> = {}): NeedLine => ({ classId: "T1", schoolId: "E1", componentId: "MAT", needed: 4, offered: 4, assigned: 2, uncovered: 2, unassignedBlockIds: ["B3", "B4"], assignmentRefs: [], inheritedGaps: [], methodology: "necessidade-professores@1", ...o });
const ok = { personId: "P1", linkLogicalId: "L1", label: "Ana", ineligibility: [] };

describe("modelo do quadro", () => {
  it("estados e totais; indeterminada não vira zero", () => {
    const cells = buildBoard([nl(), nl({ classId: "T2", needed: null, uncovered: null })], []);
    expect(cells.map((c) => c.status)).toEqual(["descoberta", "indeterminada"]);
    expect(totals(cells)).toMatchObject({ demanded: null, uncovered: null, indeterminate: 1 });
  });
  it("seleção só monta intenção local, e recusa inelegível ou bloco não aberto", () => {
    const [c] = buildBoard([nl()], []);
    expect(makeIntent(c!, ok, ["B3"]).intent?.kind).toBe("intencao-local");
    expect(makeIntent(c!, { ...ok, ineligibility: ["sem-habilitacao"] }, ["B3"]).refusal).toBe("candidato-inelegivel");
    expect(makeIntent(c!, ok, ["B1"]).refusal).toBe("bloco-nao-aberto");
  });
  it("envio exige writer e capacidade", () => {
    expect(submitState(false, true).enabled).toBe(false);
    expect(submitState(true, false).enabled).toBe(false);
    expect(submitState(true, true).enabled).toBe(true);
  });
});

describe("tela do quadro", () => {
  it("selecionar não grava nada e não há ação de formalizar", () => {
    const onPropose = vi.fn(async () => {});
    render(<AssignmentBoard lines={[nl()]} proposals={[]} candidatesFor={() => [ok]} canPropose={false} onPropose={onPropose} />);
    fireEvent.click(screen.getByRole("button", { name: /T1 · MAT/ }));
    fireEvent.click(screen.getByLabelText("B3"));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar" }));
    expect(screen.getByRole("status").textContent).toContain("Nada foi registrado");
    expect((screen.getByRole("button", { name: "Enviar como proposta" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /formaliz|aprovar|validar/i })).toBeNull();
    expect(onPropose).not.toHaveBeenCalled();
  });
  it("com capacidade, envia só como proposta", async () => {
    const onPropose = vi.fn(async () => {});
    render(<AssignmentBoard lines={[nl()]} proposals={[]} candidatesFor={() => [ok]} canPropose onPropose={onPropose} />);
    fireEvent.click(screen.getByRole("button", { name: /T1 · MAT/ }));
    fireEvent.click(screen.getByLabelText("B3"));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar como proposta" }));
    await vi.waitFor(() => expect(onPropose).toHaveBeenCalledWith(expect.objectContaining({ kind: "intencao-local", blockIds: ["B3"] })));
  });
  it("sem linhas mostra ausência, não zero", () => {
    render(<AssignmentBoard lines={[]} proposals={[]} candidatesFor={() => []} canPropose={false} />);
    expect(screen.getByText("Sem linhas de oferta")).toBeTruthy();
  });
});
