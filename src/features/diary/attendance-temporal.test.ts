import { describe, expect, it } from "vitest";
import { acceptsBase, buildAttendanceSubmission, loadDraft, markView, rosterOnDate, saveDraft, NOT_RECORDED } from "./attendance-temporal";

const allocs = [
  { studentId: "e1", classId: "t1", start: "2026-02-01" },
  { studentId: "e2", classId: "t1", start: "2026-02-01", end: "2026-05-10" }, // transferido
  { studentId: "e3", classId: "t1", start: "2026-06-01" }, // chegou depois
];
const marks = ["Presente", "Ausente"];
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

describe("frequência temporal (Docente L05)", () => {
  it("transferido permanece nas chamadas anteriores e sai das seguintes", () => {
    expect(rosterOnDate(allocs, "t1", "2026-05-10")).toEqual(["e1", "e2"]);
    expect(rosterOnDate(allocs, "t1", "2026-06-02")).toEqual(["e1", "e3"]);
  });
  it("sem marcação é Não registrada e o envio recusa em vez de presumir", () => {
    expect(markView({}, "e1")).toBe(NOT_RECORDED);
    const r = buildAttendanceSubmission({ slotKey: "s", roster: ["e1", "e2"], draft: { e1: "Presente" }, authorizedMarks: marks, expectedBaseVersion: null });
    expect(r.ok).toBe(false);
  });
  it("recusa categoria não autorizada e aluno fora da data", () => {
    expect(buildAttendanceSubmission({ slotKey: "s", roster: ["e1"], draft: { e1: "Justificada" }, authorizedMarks: marks, expectedBaseVersion: null }).ok).toBe(false);
    expect(buildAttendanceSubmission({ slotKey: "s", roster: ["e1"], draft: { e1: "Presente", e9: "Ausente" }, authorizedMarks: marks, expectedBaseVersion: null }).ok).toBe(false);
  });
  it("idempotência: mesmo conteúdo ⇒ mesma chave; base diferente ⇒ outra chave", () => {
    const a = buildAttendanceSubmission({ slotKey: "s", roster: ["e1"], draft: { e1: "Presente" }, authorizedMarks: marks, expectedBaseVersion: 1 });
    const b = buildAttendanceSubmission({ slotKey: "s", roster: ["e1"], draft: { e1: "Presente" }, authorizedMarks: marks, expectedBaseVersion: 1 });
    const c = buildAttendanceSubmission({ slotKey: "s", roster: ["e1"], draft: { e1: "Presente" }, authorizedMarks: marks, expectedBaseVersion: 2 });
    expect(a.ok && b.ok && a.submission.idempotencyKey === b.submission.idempotencyKey).toBe(true);
    expect(a.ok && c.ok && a.submission.idempotencyKey !== c.submission.idempotencyKey).toBe(true);
    expect(acceptsBase(1, 2)).toBe(false);
    expect(acceptsBase(2, 2)).toBe(true);
  });
  it("rascunho recupera só alunos ainda enturmados e marcas autorizadas, sem nomes", () => {
    const s = mem();
    saveDraft(s, "s", { e1: "Presente", e2: "Ausente", e3: undefined });
    expect(s.getItem("sigem.diary.attendance-draft.v1:s")).not.toMatch(/nome/i);
    expect(loadDraft(s, "s", ["e1"], marks)).toEqual({ e1: "Presente" });
  });
});
