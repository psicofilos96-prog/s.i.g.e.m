// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import axe from "axe-core";

const db = { seq: 0, payload: {} as Record<string, unknown>, step: 1, saves: [] as { expected: number; step: number }[], uploads: [] as string[], removed: [] as string[], completeArgs: null as null | Record<string, unknown>, failNext: "" };
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: unknown }) => children }));
vi.mock("@/features/authority/session-authority", () => ({
  useSessionAuthority: () => ({ status: "signed-in", capabilities: [{ capabilityId: "manter-matricula-e-enturmacao", schoolId: "inep-A" }] }),
}));
vi.mock("@/features/year-transition/year-transition-source", () => ({
  readYears: async () => [{ id: "ano-x", label: "Ano letivo 2027", state: "operacional" }],
  locateStudent: async () => ({ outcome: "nao-encontrado" }),
}));
vi.mock("./secretariat-source", () => ({ readSchoolLife: async () => [{ kind: "vinculo-anual" }, { kind: "turma" }] }));
vi.mock("./secretariat", () => ({ lifeKindLabel: (k: string) => (k === "turma" ? "Turma" : "Matrícula no ano") }));
vi.mock("./enrollment-wizard-source", () => ({
  openDrafts: async () => (db.seq ? [{ draftId: "d-1", sequence: db.seq, step: db.step, payload: db.payload, hasCpf: true, cpfHint: "25", inep: null, existingStudentId: null, existingStudentName: null, updatedAt: "2027-02-01T10:00:00Z", mine: true }] : []),
  saveDraft: async (a: { expected: number; step: number; payload: Record<string, unknown> }) => {
    if (a.expected !== db.seq) throw new Error("P0001: draft:stale-head");
    db.saves.push({ expected: a.expected, step: a.step }); db.seq += 1; db.payload = a.payload; db.step = a.step; return db.seq;
  },
  abandonDraft: async () => 0,
  classOptions: async () => [{ id: "t-1", name: "1º ANO A", shift: "Manhã", capacity: null, occupancy: 4 }],
  completeDraft: async (a: Record<string, unknown>) => {
    if (db.failNext) { const m = db.failNext; db.failNext = ""; throw new Error(`P0001: ${m} CONTEXT: PL/pgSQL function`); }
    db.completeArgs = a; return { student_id: "est-1", enrollment_id: "m-1", episode_id: "e-1", student_created: true };
  },
  bindPhoto: async () => "p", currentStudentPhoto: async () => null, photoUrl: async () => "blob:foto",
  uploadPhoto: async (p: string) => { db.uploads.push(p); }, removePhoto: async (p: string) => { db.removed.push(p); },
}));

import { EnrollmentWizard } from "./enrollment-wizard";

afterEach(cleanup);
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])], "f.jpg", { type: "image/jpeg" });
const fake = () => new File([new TextEncoder().encode("isto não é imagem!!")], "f.jpg", { type: "image/jpeg" });

describe("matrícula guiada — tela", () => {
  it("rascunho, retomada, foto, turma sem capacidade, recusa sem texto técnico e conclusão confirmada", async () => {
    const u = render(<EnrollmentWizard />);
    fireEvent.click(await screen.findByRole("button", { name: "Começar nova matrícula" }));
    expect(screen.getByRole("navigation", { name: "Seções da matrícula" })).toBeTruthy();
    expect(screen.getByText(/Faltam 5 informações obrigatórias/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "E2E Aluno" } });
    // foto: arquivo falso recusado pelo conteúdo, JPEG real aceito
    const file = screen.getByLabelText("Adicionar foto") as HTMLInputElement;
    fireEvent.change(file, { target: { files: [fake()] } });
    expect(await screen.findByText("Use uma foto JPG, PNG ou WEBP.")).toBeTruthy();
    expect(db.uploads).toHaveLength(0);
    fireEvent.change(file, { target: { files: [jpeg()] } });
    await waitFor(() => expect(db.uploads).toHaveLength(1));
    expect(db.uploads[0]).toMatch(/^inep-A\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
    await waitFor(() => expect((db.payload["foto"] as { path: string }).path).toBe(db.uploads[0]));
    expect(await screen.findByLabelText("Trocar foto")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sair e continuar depois" }));
    await waitFor(() => expect(screen.getByText("Continuar de onde parou")).toBeTruthy());
    u.unmount();

    // retomada: nova montagem lê só o banco
    render(<EnrollmentWizard />);
    expect(await screen.findByText("E2E Aluno")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    const sel = await screen.findByLabelText("Ano letivo");
    await waitFor(() => expect(sel.querySelectorAll("option").length).toBe(2));
    fireEvent.change(sel, { target: { value: "ano-x" } });
    fireEvent.change(screen.getByLabelText("Data de início na escola"), { target: { value: "2027-02-01" } });
    expect(await screen.findByText("Capacidade não informada · 4 enturmado(s)")).toBeTruthy();
    fireEvent.click(screen.getByText("1º ANO A"));
    expect(screen.getByText(/Tudo pronto para concluir/)).toBeTruthy();
    // recusa do banco: mensagem simples, nada técnico, rascunho continua
    db.failNext = "secretariat:class-invalid";
    fireEvent.click(screen.getByRole("button", { name: "Concluir matrícula" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, concluir matrícula" }));
    const alert = await screen.findByText("A turma não pertence a esta escola e ano.");
    expect(document.body.textContent).not.toMatch(/P0001|PL\/pgSQL|secretariat:|[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(alert).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Concluir matrícula" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, concluir matrícula" }));
    expect(await screen.findByText("Matrícula concluída — E2E Aluno")).toBeTruthy();
    expect(db.completeArgs).toMatchObject({ draft: "d-1", expected: db.seq, year: "ano-x", on: "2027-02-01", classId: "t-1" });
    // cada gravação usou a base esperada correta (sem colisão)
    db.saves.forEach((s, i) => expect(s.expected).toBe(i));
    const r = await axe.run(document.body, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});
