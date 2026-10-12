import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { attendanceSummary, recordProblems, type AttendanceRecord } from "./formation-attendance";

const rec = (unitId: string, o: Partial<AttendanceRecord> = {}): AttendanceRecord => ({ unitId, version: 1, mode: "presencial", status: "presente",
  evidenceKind: "lista-de-presenca", evidenceRef: "Lista assinada 07/03", connectedMinutes: null, reason: null, ...o });

describe("L12 frequência formativa", () => {
  it("abrir material não prova participação", () => {
    expect(recordProblems({ ...rec("a"), evidenceKindRaw: "acesso-a-material" }).join()).toMatch(/não prova/);
  });
  it("assíncrona só com entrega; remota síncrona com duração", () => {
    expect(recordProblems(rec("a", { mode: "assincrona", evidenceKind: "observacao-do-formador" })).join()).toMatch(/entrega/);
    expect(recordProblems(rec("a", { mode: "remota-sincrona", evidenceKind: "registro-de-conexao-com-duracao" })).join()).toMatch(/minutos/);
    expect(recordProblems(rec("a", { mode: "remota-sincrona", evidenceKind: "registro-de-conexao-com-duracao", connectedMinutes: 110 }))).toEqual([]);
  });
  it("presença sem evidência e correção sem motivo são recusadas", () => {
    expect(recordProblems(rec("a", { evidenceRef: null })).join()).toMatch(/evidência/);
    expect(recordProblems(rec("a", { version: 2 })).join()).toMatch(/Correção/);
  });
  it("não lançado nunca vira falta: percentual fica null", () => {
    const s = attendanceSummary(["m1", "m2"], [rec("m1")]);
    expect(s.notRecorded).toEqual(["m2"]); expect(s.absent).toBe(0); expect(s.pct).toBeNull();
  });
  it("correção prevalece e justificada sai do denominador", () => {
    const s = attendanceSummary(["m1", "m2", "m3"], [rec("m1", { status: "ausente", evidenceKind: null, evidenceRef: null }),
      rec("m1", { version: 2, reason: "Lista conferida pelo formador" }), rec("m2", { status: "ausente", evidenceKind: null, evidenceRef: null }),
      rec("m3", { status: "ausencia-justificada", evidenceKind: null, evidenceRef: null, reason: "Convocação oficial" })]);
    expect(s.pct).toBe(50); expect(s.justified).toBe(1);
  });
  it("cadeia com lacuna fica ambígua", () => expect(attendanceSummary(["m1"], [rec("m1", { version: 2, reason: "corrigido depois" })]).ambiguous).toEqual(["m1"]));
  it("migration 0441: sem evidência de acesso, append-only, participante não lança a si", () => {
    const sql = readFileSync("drizzle/migrations/0441_dev12_attendance.sql", "utf8");
    expect(sql).not.toMatch(/'acesso-a-material'|'download'/);
    expect(sql).toMatch(/devatt_immutable BEFORE UPDATE OR DELETE/);
    expect(sql).toMatch(/dev:self-attendance/);
    expect(sql).toMatch(/dev:stale/);
  });
});
