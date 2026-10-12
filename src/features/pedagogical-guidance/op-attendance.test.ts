import { describe, it, expect } from "vitest";
import { classAttendancePanel, studentAttendancePanel, longestAbsenceStreak, referToSector, sharedReferralView, centralAttendance, type AttSources } from "./op-attendance";
import type { OfficialMark } from "@/features/school-management/attendance-permanence";
import type { OpDesignation } from "./op-designations";

const mk = (studentId: string, date: string, lessonId: string, mark: "presente" | "ausente"): OfficialMark => ({ studentId, classId: "c1", date, lessonId, mark, authorEngagementId: "prof" });
const marks = [mk("a", "2026-10-01", "l1", "ausente"), mk("a", "2026-10-02", "l2", "ausente"), mk("a", "2026-10-03", "l3", "ausente"), mk("a", "2026-10-06", "l4", "presente"), mk("b", "2026-10-01", "l1", "presente")];
const expected = ["l1", "l2", "l3", "l4", "l5"].map((id, i) => ({ lessonId: id, classId: "c1", date: `2026-10-0${i + 1}` }));
const src: AttSources = { marks: true, schedule: true, enrollment: true, readAt: "2026-10-12" };
const periods = [{ id: "s1", from: "2026-10-01", to: "2026-10-03" }, { id: "s2", from: "2026-10-04", to: "2026-10-10" }];
const d: OpDesignation = { logicalId: "d", role: "orientador-da-unidade", personId: "op", schoolIds: ["s1"], classIds: null, from: "2026-01-01", to: null, substituteOf: null, history: [] };
const access = { personNatural: true, personId: "op", date: "2026-10-12", schoolId: "s1", classId: "c1", purpose: "acompanhamento", designations: [d], capabilities: [{ id: "consultar-acompanhamento-pedagogico", scope: "escola" as const, schoolId: "s1" }] };
const proc = { id: "p", schoolId: "s1", studentId: "a", processVersion: "pm-1", events: [{ step: "alerta" as const, by: "op", isNaturalPerson: true, on: "2026-10-07" }] };

describe("Lote 10 — frequência e permanência", () => {
  it("chamada não realizada é separada de ausência", () => {
    const p = classAttendancePanel({ classId: "c1", periods, marks, expected, sources: src }).periods;
    expect(p[0]).toMatchObject({ lessonsWithCall: 3, callsNotRecorded: 0, absences: 3 });
    expect(p[1]).toMatchObject({ lessonsWithCall: 1, callsNotRecorded: 1, absences: 0, rate: 1 });
  });
  it("sem grade: não realizadas = null; sem chamadas: bloqueado", () => {
    expect(classAttendancePanel({ classId: "c1", periods, marks, expected, sources: { ...src, schedule: false } }).periods[0]!.callsNotRecorded).toBeNull();
    expect(classAttendancePanel({ classId: "c1", periods, marks, expected, sources: { ...src, marks: false } }).blocked).toBeTruthy();
  });
  it("estudante autorizado: evolução por período, sequência, alerta só homologado", () => {
    const r: any = studentAttendancePanel({ studentId: "a", window: { studentId: "a", from: "2026-02-01", to: null }, periods, marks, params: null, access, sources: src });
    if (r.blocked) throw new Error(r.blocked);
    expect(r.evolution.map((e) => e.state)).toEqual(["apurado", "apurado"]);
    expect(r.longestStreak).toBe(3);
    expect(r.alert.alert).toBe(false);
    const h: any = studentAttendancePanel({ studentId: "a", window: { studentId: "a", from: "2026-02-01", to: null }, periods, marks, params: { version: "v1", homologated: true, minRate: 0.75, recurringAbsences: 3, windowDays: 30 }, access, sources: src });
    expect(!h.blocked && h.alert.alert).toBe(true);
  });
  it("acesso individual fail-closed", () => {
    const base = { studentId: "a", window: { studentId: "a", from: "2026-02-01", to: null }, periods, marks, params: null, sources: src };
    expect(studentAttendancePanel({ ...base, access: { ...access, capabilities: [] } }).blocked).toBeTruthy();
    expect(studentAttendancePanel({ ...base, access: { ...access, personNatural: false } }).blocked).toBeTruthy();
    expect(studentAttendancePanel({ ...base, access, sources: { ...src, enrollment: false } }).blocked).toMatch(/matrícula/);
  });
  it("encaminhamento usa o procedimento existente e protege motivo sensível", () => {
    const base = { procedure: proc, to: "secretaria" as const, byPersonId: "op", isNaturalPerson: true, on: "2026-10-08", reasonCategory: "violencia" as const, publicNote: "Encaminhar para contato", protocolRef: "PROT-1" };
    expect(referToSector({ ...base, publicNote: "suspeita de violência em casa" }, "s1")).toMatchObject({ ok: false, code: "op:motivo-sensivel-no-texto" });
    const ok = referToSector(base, "s1");
    expect(ok.ok).toBe(true);
    expect(referToSector({ ...base, isNaturalPerson: false }, "s1").ok).toBe(false);
    expect(referToSector({ ...base, procedure: { ...proc, processVersion: null } }, "s1").ok).toBe(false);
    expect(sharedReferralView({ reasonCategory: "violencia", destination: "secretaria", on: "x", protocolRef: "P" }).reason).toBe("motivo restrito à escola");
    expect(sharedReferralView({ reasonCategory: "frequencia", destination: "direcao", on: "x", protocolRef: null }).reason).toBe("frequencia");
  });
  it("sequência de ausências e central suprimido", () => {
    expect(longestAbsenceStreak(marks, "b")).toBe(0);
    const p = classAttendancePanel({ classId: "c1", periods, marks, expected, sources: src });
    expect(centralAttendance(p, 2).state).toBe("suprimido");
    expect(centralAttendance(p, 25)).toMatchObject({ state: "ok" });
  });
});
