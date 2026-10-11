import { describe, expect, it } from "vitest";
import { aeeAttendance, aeeWorkload, deadlineAlerts, planPrint, protocolPrint, roomConflicts, visitCalendar } from "./nei-operational";

describe("NEI operacional", () => {
  it("alertas só com prazo declarado; janela só configurada", () => {
    const items = [{ id: "a", due: "2026-10-01", closed: false }, { id: "b", due: "2026-10-13", closed: false }, { id: "c", due: null, closed: false }];
    expect(deadlineAlerts(items, "2026-10-11", null)).toEqual([{ id: "a", kind: "vencido" }]);
    expect(deadlineAlerts(items, "2026-10-11", 3).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("calendário conta visitas sem data", () => expect(visitCalendar([{ id: "1", date: "2026-10-12" }, { id: "2", date: null }]).undated).toBe(1));
  it("frequência AEE: sem marcação não é falta", () => {
    expect(aeeAttendance([{ held: true, mark: "presente" }, { held: true, mark: null }, { held: false, mark: null }])).toEqual({ held: 2, present: 1, absent: 0, unmarked: 1, rate: 1 });
    expect(aeeAttendance([{ held: true, mark: null }]).rate).toBeNull();
  });
  it("conflito de sala só registrado", () => {
    expect(roomConflicts([{ id: "x", room: "S1", weekday: 1, start: "08:00", end: "09:00" }, { id: "y", room: "S1", weekday: 1, start: "08:30", end: "10:00" }, { id: "z", room: null, weekday: 1, start: "08:00", end: "09:00" }])).toEqual([["x", "y"]]);
  });
  it("jornada sem fonte", () => expect(aeeWorkload({ hours: 20, sourceRef: null }).state).toBe("sem-fonte"));
  it("PDF de protocolo recusa texto clínico; plano marca não oficial", () => {
    expect(protocolPrint({ number: "1", subject: "Laudo do aluno", body: "conforme laudo F84", destination: "Direção", sentAt: "2026-10-11" }).ok).toBe(false);
    const ok = protocolPrint({ number: "1", subject: "Reunião de apoio", body: "Agendar reunião com a equipe", destination: "Direção", sentAt: "2026-10-11" });
    expect(ok.ok && ok.html.includes("não é documento oficial")).toBe(true);
    expect(planPrint({ kind: "PEI", version: 2, status: "concluído", goals: [{ text: "Leitura", due: null }] })).toContain("não declarado");
  });
});
