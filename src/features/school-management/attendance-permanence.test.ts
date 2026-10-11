import { describe, expect, it } from "vitest";
import { advance, classSeries, infrequencyAlert, studentRate, type OfficialMark, type Procedure } from "./attendance-permanence";

const mk = (studentId: string, date: string, mark: "presente" | "ausente"): OfficialMark => ({ studentId, classId: "c1", date, lessonId: date, mark, authorEngagementId: "prof1" });
const marks = [mk("a", "2026-03-02", "ausente"), mk("a", "2026-03-03", "presente"), mk("a", "2026-03-10", "ausente"), mk("a", "2026-03-11", "ausente"), mk("b", "2026-03-11", "presente")];
const P = { from: "2026-03-01", to: "2026-03-31" };
const params = { version: "v1", homologated: true, minRate: 0.75, recurringAbsences: 3, windowDays: 30 };

describe("Direção — frequência e busca ativa", () => {
  it("vigências diferentes mudam o denominador; autoria docente preservada", () => {
    expect(studentRate(marks, { studentId: "a", from: "2026-03-01", to: null }, P)).toMatchObject({ total: 4, present: 1, authors: ["prof1"] });
    expect(studentRate(marks, { studentId: "a", from: "2026-03-05", to: null }, P)).toMatchObject({ total: 2, present: 0 });
    expect(studentRate(marks, { studentId: "a", from: "2026-03-01", to: "2026-03-03" }, P)).toMatchObject({ total: 2, present: 1 });
    expect(studentRate(marks, { studentId: "a", from: null, to: null }, P).state).toBe("indeterminado");
    expect(studentRate(marks, { studentId: "z", from: "2026-03-01", to: null }, P).state).toBe("sem-denominador");
  });
  it("dia sem chamada não vira zero na série", () => {
    expect(classSeries(marks, "c1").map((d) => d.date)).toEqual(["2026-03-02", "2026-03-03", "2026-03-10", "2026-03-11"]);
  });
  it("alerta só com parâmetro homologado e nunca afirma evasão", () => {
    const w = { studentId: "a", from: "2026-03-01", to: null };
    expect(infrequencyAlert(marks, w, P, null).alert).toBe(false);
    const r = infrequencyAlert(marks, w, P, params);
    expect(r).toMatchObject({ alert: true, reasons: ["taxa-abaixo", "faltas-recorrentes"] });
    expect(JSON.stringify(r)).not.toMatch(/evas/);
  });
  it("procedimento segue a ordem, exige humano, canal e justificativa", () => {
    let p: Procedure = { id: "p", schoolId: "A", studentId: "a", processVersion: null, events: [] };
    expect(advance(p, { step: "alerta", by: "d", isNaturalPerson: true, on: "2026-04-01" }, "A")).toMatchObject({ code: "busca:processo-municipal-nao-registrado" });
    p = { ...p, processVersion: "pm-1" };
    expect(advance(p, { step: "alerta", by: "d", isNaturalPerson: true, on: "x" }, "B")).toMatchObject({ code: "busca:fora-da-escola" });
    expect(advance(p, { step: "alerta", by: "robo", isNaturalPerson: false, on: "x" }, "A")).toMatchObject({ code: "busca:autor-humano-obrigatorio" });
    expect(advance(p, { step: "contato", by: "d", isNaturalPerson: true, on: "x" }, "A")).toMatchObject({ code: "busca:etapa-fora-de-ordem" });
    const a = advance(p, { step: "alerta", by: "d", isNaturalPerson: true, on: "x" }, "A"); if (!a.ok) throw 0;
    expect(advance(a.procedure, { step: "encerramento", by: "d", isNaturalPerson: true, on: "x" }, "A")).toMatchObject({ code: "busca:justificativa-obrigatoria" });
    const e = advance(a.procedure, { step: "encaminhamento", by: "d", isNaturalPerson: true, on: "x", sector: "orientacao" }, "A"); if (!e.ok) throw 0;
    const c = advance(e.procedure, { step: "contato", by: "o", isNaturalPerson: true, on: "x", contactChannel: "telefone" }, "A");
    expect(c.ok && c.procedure.events.at(-1)?.contactConfirmed).toBe(false);
  });
});
