import { describe, it, expect } from "vitest";
import { buildPanel, dayAgenda, weekDates, safeTitle, type MediatedStudent, type ScheduleBlock, type OwnedEvent } from "./mediator-panel";

const st: MediatedStudent[] = [
  { mediation_logical_id: "L1", school_id: "sA", student_id: "e1", student_name: "ANA", class_id: "5A", valid_from: "2026-02-01", valid_to: null },
  { mediation_logical_id: "L2", school_id: "sB", student_id: "e7", student_name: "BIA", class_id: "3B", valid_from: "2026-02-01", valid_to: "2026-03-01" },
];
const blocks: ScheduleBlock[] = [
  { classId: "5A", weekday: 2, start: "07:30", end: "08:20", shift: "manhã", component: "Matemática" },
  { classId: "9Z", weekday: 2, start: "07:30", end: "08:20", shift: "tarde", component: "Arte" },
];
const ev: OwnedEvent[] = [
  { id: "r1", kind: "reuniao", date: "2026-03-10", start: "10:00", title: "Reunião de planejamento", owner: "Orientação", studentId: null, href: "/x" },
  { id: "o1", kind: "orientacao", date: "2026-03-10", start: null, title: "Laudo CID F84 atualizado", owner: "NEI", studentId: "e1", href: "/y" },
  { id: "o2", kind: "orientacao", date: "2026-03-10", start: null, title: "Outro aluno", owner: "NEI", studentId: "e99", href: "/z" },
];

describe("Mediador L03 — painel e agenda", () => {
  it("painel: escolas e turno das turmas dos estudantes; fonte não lida ≠ zero", () => {
    const p = buildPanel({ date: "2026-03-10", students: st, blocks, dayEffect: "letivo", events: ev, guidanceCount: 2, pendingRecords: null, openRequests: 0 });
    expect(p.schools).toEqual(["sA", "sB"]);
    expect(p.shifts).toEqual(["manhã"]);
    expect(p.pendingRecords).toEqual({ state: "nao-disponivel" });
    expect(p.openRequests).toEqual({ state: "disponivel", value: 0 });
    expect(p.events?.map((e) => e.id)).toEqual(["r1", "o1"]);
  });
  it("nenhum dado clínico no painel", () => {
    const p = buildPanel({ date: "2026-03-10", students: st, blocks, dayEffect: "letivo", events: ev, guidanceCount: 0, pendingRecords: 0, openRequests: 0 });
    expect(JSON.stringify(p)).not.toMatch(/CID|F84|laudo/i);
    expect(safeTitle("Transtorno do espectro")).toBe("Item restrito ao NEI");
  });
  it("sessão sem estudantes desabilita ações; estudantes não lidos = não disponível", () => {
    const p = buildPanel({ date: "2026-03-10", students: null, blocks: null, dayEffect: null, events: null, guidanceCount: null, pendingRecords: null, openRequests: null });
    expect(p.studentsState).toBe("nao-disponivel");
    expect(p.quickActions.every((a) => !a.enabled)).toBe(true);
  });
  it("agenda usa grade e calendário oficiais; dia não letivo não confirma aula", () => {
    const a = dayAgenda({ date: "2026-03-10", students: st, blocks, dayEffect: "letivo", events: ev });
    expect(a.items.map((i) => i.kind)).toEqual(["aula", "reuniao", "orientacao"]);
    expect(a.items.some((i) => i.classId === "9Z")).toBe(false);
    const f = dayAgenda({ date: "2026-03-10", students: st, blocks, dayEffect: "nao-letivo", events: [] });
    expect(f.items).toEqual([]); expect(f.notices[0]).toMatch(/não-letivo/);
    expect(dayAgenda({ date: "2026-03-10", students: st, blocks, dayEffect: null, events: [] }).notices[0]).toMatch(/não lido/);
  });
  it("designação encerrada sai da agenda; semana começa na segunda", () => {
    const a = dayAgenda({ date: "2026-03-10", students: st, blocks: [{ classId: "3B", weekday: 2, start: "13:00", end: "14:00", shift: "tarde", component: null }], dayEffect: "letivo", events: [] });
    expect(a.items).toEqual([]);
    expect(weekDates("2026-03-12")[0]).toBe("2026-03-09");
  });
});
