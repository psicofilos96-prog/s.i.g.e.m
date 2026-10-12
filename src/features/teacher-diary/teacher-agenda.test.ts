import { describe, expect, it } from "vitest";
import { agendaRange, buildAgenda, noAssignmentMessage } from "./teacher-agenda";

const blocks = [
  { classId: "t1", assignmentId: "a1", weekday: 1, start: "07:20", end: "08:10", className: "6º A" },
  { classId: "t2", assignmentId: "a2", weekday: 1, start: "08:00", end: "08:50", className: "7º B" },
];
const assignments = [{ assignmentId: "a1", start: "2026-02-01" }, { assignmentId: "a2", start: "2026-02-01", end: "2026-10-05" }];
const base = { blocks, assignments, events: [] };

describe("agenda docente (L06)", () => {
  it("intervalos dia/semana/mês/período", () => {
    expect(agendaRange("semana", "2026-10-14")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(agendaRange("mes", "2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(() => agendaRange("periodo", "2026-10-01")).toThrow();
  });
  it("aula sem atribuição vigente não aparece e é explicada", () => {
    const [d] = buildAgenda({ ...base, from: "2026-10-12", to: "2026-10-12", calendar: [{ date: "2026-10-12", effect: "letivo" }] });
    expect(d!.items.map((i) => i.type === "aula" && i.className)).toEqual(["6º A"]);
    expect(d!.messages.join()).toMatch(/sem atribuição vigente/);
    expect(noAssignmentMessage(assignments, "2026-01-10")).toMatch(/não tem atribuição/);
  });
  it("conflito de horário é avisado", () => {
    const [d] = buildAgenda({ ...base, from: "2026-10-05", to: "2026-10-05", calendar: [{ date: "2026-10-05", effect: "letivo" }] });
    expect(d!.messages.join()).toMatch(/Conflito 07:20–08:10/);
  });
  it("feriado, suspensão e dia indeterminado não confirmam aulas; eventos permanecem", () => {
    const ev = [{ date: "2026-10-12", kind: "conselho" as const, title: "Conselho", sourceRef: "ata:1" }];
    const [f] = buildAgenda({ ...base, events: ev, from: "2026-10-12", to: "2026-10-12", calendar: [{ date: "2026-10-12", effect: "nao-letivo", label: "Feriado" }] });
    expect(f!.items.map((i) => i.type)).toEqual(["evento"]);
    expect(f!.messages[0]).toMatch(/Feriado/);
    const [s] = buildAgenda({ ...base, from: "2026-10-12", to: "2026-10-12", calendar: [{ date: "2026-10-12", effect: "letivo", suspended: true }] });
    expect(s!.items).toEqual([]);
    const [u] = buildAgenda({ ...base, from: "2026-10-12", to: "2026-10-12", calendar: [] });
    expect(u!.items).toEqual([]);
  });
  it("reposição declarada segue a grade do dia indicado", () => {
    const [r] = buildAgenda({ ...base, from: "2026-10-17", to: "2026-10-17", calendar: [{ date: "2026-10-17", effect: "letivo", replacesDate: "2026-10-12" }] });
    expect(r!.items[0]).toMatchObject({ type: "aula", status: "reposicao", className: "6º A" });
  });
});
