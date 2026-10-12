import { describe, it, expect } from "vitest";
import { projectPostReturn, closureIssues, reopenIssues, reopenKey } from "./post-return";

const cal = new Map([["2026-05-10", "letivo"], ["2026-06-02", "letivo"], ["2026-06-03", "letivo"]] as const);
const attendance = {
  lessons: [{ lessonId: "a", date: "2026-05-10" }, { lessonId: "b", date: "2026-06-02" }, { lessonId: "c", date: "2026-06-03" }],
  marks: new Map([["a", "ausente"], ["b", "presente"]] as const),
  calendar: cal, enrollment: { from: "2026-03-01", to: null }, asOf: "2026-10-12",
};

describe("L15 pós-retorno", () => {
  it("frequência conta só a partir do retorno; aula sem lançamento fica fora", () => {
    const v = projectPostReturn({ returnedOn: "2026-06-01", attendance, barriers: [], plan: null });
    expect(v.attendanceAfterReturn!.absent).toBe(0);
    expect(v.attendanceAfterReturn!.marked).toBe(1);
    expect(v.closureBlockers).toEqual([]);
  });
  it("fonte não lida bloqueia, nunca vira zero", () => {
    const v = projectPostReturn({ returnedOn: "2026-06-01", attendance, barriers: null, plan: undefined });
    expect(v.remainingBarriers).toBeNull(); expect(v.openActions).toBeNull();
    expect(v.closureBlockers).toEqual(expect.arrayContaining(["barreiras-nao-lidas", "plano-nao-lido"]));
  });
  it("encerramento exige pessoa, fundamento e declarar cada bloqueio", () => {
    const v = projectPostReturn({ returnedOn: null, attendance, barriers: [], plan: null });
    expect(closureIssues(v, { justification: "curto", acknowledged: [], person: null })).toEqual(expect.arrayContaining(["sem-pessoa", "sem-fundamento", "sem-retorno-registrado"]));
    expect(closureIssues(v, { justification: "Família mudou de município, conferido.", acknowledged: ["sem-retorno-registrado"], person: "p" })).toEqual([]);
  });
  it("reincidência reabre o mesmo caso com evidência e chave estável", () => {
    expect(reopenIssues({ closed: false }, { justification: "x", evidenceRef: null, person: null })).toHaveLength(4);
    expect(reopenIssues({ closed: true }, { justification: "Novas faltas registradas no Diário oficial.", evidenceRef: "alert:9", person: "p" })).toEqual([]);
    expect(reopenKey("c", "alert:9")).toBe(reopenKey("c", "alert:9"));
  });
});
