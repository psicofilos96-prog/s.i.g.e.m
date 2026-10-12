/**
 * Docente LOTE 20 — aceitação integrada sobre fixtures sintéticas em memória
 * (camada provada: núcleos puros; NÃO prova RLS/sessão — ver docs/docente-matriz-aceite-lote-20.md).
 */
import { describe, it, expect } from "vitest";
import { rosterOnDate, buildAttendanceSubmission } from "@/features/diary/attendance-temporal";
import { infantGuard } from "./infant-portfolio";
import { reportReadiness, nextEmission } from "./teacher-reports";
import { canTeacherWrite, canCorrectOthers, projectForSector, type Principal } from "./teacher-security";
import { myHistory, preClosing, applyClosingAct, closingState, type ClosingEvent } from "./teacher-history-closing";
import { saveReducer } from "./teacher-ux-robustness";

const A: Principal = { kind: "pessoa", personId: "profA", capabilities: [] };
const SUB: Principal = { kind: "pessoa", personId: "sub", capabilities: [] };
const asg = [
  { personId: "profA", schoolId: "escA", classId: "5A", componentId: "mat", from: "2026-02-01", to: "2026-04-30" }, // vínculo encerrado
  { personId: "profA", schoolId: "escB", classId: "EJA1", componentId: "mat", from: "2026-02-01", to: null },
  { personId: "sub", schoolId: "escA", classId: "5A", componentId: "mat", from: "2026-03-10", to: "2026-03-20" },
];
const allocs = [
  { studentId: "e1", classId: "5A", start: "2026-02-01" },
  { studentId: "e2", classId: "5A", start: "2026-02-01", end: "2026-03-15" }, // transferido
];

describe("Docente L20 — aceitação integrada", () => {
  it("professor em escola A e B, só na própria atribuição", () => {
    expect(canTeacherWrite(A, asg, { schoolId: "escB", classId: "EJA1", componentId: "mat", date: "2026-08-01", authorPersonId: "profA" }).ok).toBe(true);
    expect(canTeacherWrite(A, asg, { schoolId: "escB", classId: "5A", componentId: "mat", date: "2026-03-01", authorPersonId: "profA" }).ok).toBe(false);
  });
  it("substituto só no período e vínculo encerrado só leitura + histórico preservado", () => {
    const t = { schoolId: "escA", classId: "5A", componentId: "mat", authorPersonId: "sub" };
    expect(canTeacherWrite(SUB, asg, { ...t, date: "2026-03-12" }).ok).toBe(true);
    expect(canTeacherWrite(SUB, asg, { ...t, date: "2026-03-25" }).ok).toBe(false);
    expect(canTeacherWrite(A, asg, { ...t, date: "2026-05-02", authorPersonId: "profA" }).ok).toBe(false);
    const facts = [{ id: "f1", kind: "aula" as const, authorPersonId: "profA", schoolId: "escA", classId: "5A", componentId: "mat", periodId: "b1", date: "2026-03-01" }];
    expect(myHistory("profA", facts, { schoolId: "escA" })).toHaveLength(1);
  });
  it("transferência e chamada retroativa: roster da data, nunca presença presumida", () => {
    expect(rosterOnDate(allocs, "5A", "2026-03-10")).toEqual(["e1", "e2"]);
    expect(rosterOnDate(allocs, "5A", "2026-03-20")).toEqual(["e1"]);
    const r = buildAttendanceSubmission({ slotKey: "5A|2026-03-10|1", roster: ["e1", "e2"], draft: { e1: "Presente" }, authorizedMarks: ["Presente", "Ausente"], expectedBaseVersion: null });
    expect(r.ok).toBe(false);
  });
  it("EI recusa nota/retenção", () => {
    expect(infantGuard("Aluno reprovado, nota 4").length).toBeGreaterThan(0);
  });
  it("fechamento: pendência bloqueia, encerramento só por capacidade, reabertura versiona", () => {
    const pend = preClosing({ expectedLessons: ["l1"], recordedLessons: [], expectedAttendance: [], concludedAttendance: [], pendingGrades: 0, pendingRecovery: 1, pendingDocuments: 0 });
    expect(pend.ready).toBe(false);
    const ok = preClosing({ expectedLessons: [], recordedLessons: [], expectedAttendance: [], concludedAttendance: [], pendingGrades: 0, pendingRecovery: 0, pendingDocuments: 0 });
    const policy = { closeCapability: "encerrar-diario", reopenCapability: "reabrir-diario" };
    const ev: ClosingEvent[] = [];
    const s = applyClosingAct(ev, { act: "submeter", actorPersonId: "profA", actorCapabilities: [], ownerPersonId: "profA", expectedSeq: 0, idempotencyKey: "s", policy, preClosing: ok });
    if (!s.ok) throw new Error(s.reason); ev.push(s.event);
    expect(applyClosingAct(ev, { act: "encerrar", actorPersonId: "dir", actorCapabilities: ["gerir-escola"], ownerPersonId: "profA", expectedSeq: 1, idempotencyKey: "e", policy }).ok).toBe(false);
    const e = applyClosingAct(ev, { act: "encerrar", actorPersonId: "dir", actorCapabilities: ["encerrar-diario"], ownerPersonId: "profA", expectedSeq: 1, idempotencyKey: "e", policy });
    if (!e.ok) throw new Error(e.reason); ev.push(e.event);
    const r = applyClosingAct(ev, { act: "reabrir", actorPersonId: "dir", actorCapabilities: ["reabrir-diario"], ownerPersonId: "profA", expectedSeq: 2, reason: "nota lançada errada", idempotencyKey: "r", policy });
    if (!r.ok) throw new Error(r.reason); ev.push(r.event);
    expect(closingState(ev)).toEqual({ state: "aberto", version: 2 });
    expect(canCorrectOthers({ kind: "pessoa", personId: "dir", capabilities: ["gerir-escola"] }, { schoolId: "escA", classId: "5A", componentId: "mat", date: "2026-03-01", authorPersonId: "profA" }, null).ok).toBe(false);
  });
  it("PDF: fonte não lida bloqueia; reemissão igual não cria versão", () => {
    expect(reportReadiness("diario-de-classe", {}, true).ok).toBe(false);
    expect(nextEmission([{ version: 1, hash: "h" }], "h")).toEqual({ version: 1, changed: false });
  });
  it("família só a própria criança, sem campo sensível; salvo só com confirmação", () => {
    expect(projectForSector("familia", { studentId: "e1", laudo: "x" }, { familyStudentIds: ["e9"] })).toBeNull();
    expect(saveReducer({ kind: "sending", key: "k" }, { type: "timeout", key: "k" }).kind).toBe("unknown");
  });
});
