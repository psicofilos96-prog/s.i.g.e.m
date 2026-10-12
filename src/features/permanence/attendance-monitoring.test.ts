import { describe, expect, it } from "vitest";
import { attendanceTrend, monitorAttendance, monitoringNotes, type DayKind, type Mark } from "./attendance-monitoring";

const days = (n: number) => Array.from({ length: n }, (_, k) => `2026-03-${String(k + 1).padStart(2, "0")}`);
const cal = (ds: string[], over: Record<string, DayKind> = {}) => new Map(ds.map((d) => [d, over[d] ?? "letivo"]));
const lessons = (ds: string[]) => ds.map((d) => ({ lessonId: `l-${d}`, date: d }));
const marks = (o: Record<string, Mark>) => new Map(Object.entries(o).map(([d, m]) => [`l-${d}`, m]));
const D = days(10);
const base = { lessons: lessons(D), calendar: cal(D), enrollment: { from: "2026-03-01", to: null }, asOf: "2026-03-10" };

describe("Permanência L02 monitoramento", () => {
  it("sem lançamento não é falta: fora do denominador e interrompe sequência", () => {
    const m = monitorAttendance({ ...base, marks: marks({ "2026-03-01": "ausente", "2026-03-02": "ausente", "2026-03-04": "ausente" }) });
    expect(m).toMatchObject({ absent: 3, present: 0, unmarked: 7, marked: 3, rate: 1, longestConsecutive: 2, consecutiveAbsences: 0, streakInterruptedByMissingRecord: true });
  });
  it("calendário e vigência delimitam; futuras fora", () => {
    const m = monitorAttendance({ ...base, calendar: cal(D, { "2026-03-03": "nao-letivo", "2026-03-04": "indeterminado" }),
      enrollment: { from: "2026-03-02", to: "2026-03-08" }, asOf: "2026-03-07", marks: marks({ "2026-03-01": "ausente", "2026-03-05": "presente" }) });
    expect(m.excluded).toEqual({ "fora-da-vigencia": 1, "dia-nao-letivo": 1, "dia-indeterminado": 1, futura: 3 });
    expect(m).toMatchObject({ considered: 4, present: 1, absent: 0, unmarked: 3, rate: 0 });
  });
  it("fonte não lida ⇒ sem cálculo, nunca zero", () => {
    expect(monitorAttendance({ ...base, calendar: null, marks: new Map() })).toMatchObject({ status: "sem-calendario", rate: null });
    expect(monitorAttendance({ ...base, enrollment: null, marks: new Map() })).toMatchObject({ status: "sem-vigencia", rate: null });
  });
  it("sequência atual de faltas contíguas", () => {
    const m = monitorAttendance({ ...base, marks: marks(Object.fromEntries(D.map((d, k) => [d, k < 6 ? "presente" : "ausente"]))) });
    expect(m).toMatchObject({ consecutiveAbsences: 4, longestConsecutive: 4, rate: 0.4 });
  });
  it("tendência só com parâmetros e base mínima", () => {
    const a = monitorAttendance({ ...base, marks: marks(Object.fromEntries(D.map((d, k) => [d, k < 9 ? "presente" : "ausente"]))) });
    const b = monitorAttendance({ ...base, marks: marks(Object.fromEntries(D.map((d, k) => [d, k < 5 ? "presente" : "ausente"]))) });
    expect(attendanceTrend(a, b, null).kind).toBe("indeterminada");
    expect(attendanceTrend(a, b, { minMarkedPerWindow: 20, tolerance: 0.05 }).kind).toBe("indeterminada");
    expect(attendanceTrend(a, b, { minMarkedPerWindow: 5, tolerance: 0.05 })).toMatchObject({ kind: "piora" });
  });
  it("notas nunca afirmam abandono", () => {
    const notes = monitoringNotes(monitorAttendance({ ...base, marks: new Map() })).join(" ");
    expect(notes).toMatch(/nunca abandono/);
    expect(notes).toMatch(/não contam como falta/);
  });
});
