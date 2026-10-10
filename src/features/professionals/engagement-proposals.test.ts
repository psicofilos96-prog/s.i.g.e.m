import { describe, it, expect } from "vitest";
import { proposeEngagements, teachingAssignmentGate, type StaffRow } from "./engagement-proposals";

const row = (o: Partial<StaffRow>): StaffRow => ({ sourceSha256: "h".repeat(64), sheet: "S", rowNo: 1, schoolInep: "33000001", registration: "M1", functionLabel: "Professor", validFrom: "2026-08-01", validUntil: null, ...o });
const persons = new Map([["M1", ["p1"]], ["M2", ["p2", "p3"]]]);
const schools = new Set(["33000001", "33000002"]);

describe("propostas de atuação (sintético)", () => {
  it("vincula só por matrícula funcional + INEP + vigência", () => { expect(proposeEngagements([row({})], persons, schools).ready).toHaveLength(1); });
  it("sem matrícula, matrícula sem pessoa ou ambígua ficam pendentes; nome não vincula", () => {
    const r = proposeEngagements([row({ rowNo: 1, registration: null }), row({ rowNo: 2, registration: "X" }), row({ rowNo: 3, registration: "M2" })], persons, schools);
    expect(r.ready).toHaveLength(0); expect(r.summary).toEqual({ "sem-matricula-funcional": 1, "matricula-sem-pessoa": 1, "matricula-ambigua": 1 });
  });
  it("escola desconhecida, vigência ou função ausente ficam pendentes", () => {
    const r = proposeEngagements([row({ rowNo: 1, schoolInep: "1" }), row({ rowNo: 2, validFrom: null }), row({ rowNo: 3, functionLabel: "" })], persons, schools);
    expect(r.summary).toEqual({ "escola-nao-identificada": 1, "vigencia-ausente": 1, "funcao-nao-comprovada": 1 });
  });
  it("reenvio do mesmo arquivo é idempotente (chave hash+aba+linha)", () => { expect(proposeEngagements([row({}), row({})], persons, schools).summary).toEqual({ duplicada: 1 }); });
  it("prévia aponta conflito de funções sobrepostas", () => {
    expect(proposeEngagements([row({ rowNo: 1 }), row({ rowNo: 2, functionLabel: "Diretor" })], persons, schools).conflicts).toHaveLength(1);
  });
  it("docência exige função docente comprovada", () => {
    const p = proposeEngagements([row({ functionLabel: "Secretário" })], persons, schools).ready[0]!;
    expect(teachingAssignmentGate(p, "mat", "t1").ok).toBe(false);
    expect(teachingAssignmentGate(null, "mat", "t1").ok).toBe(false);
  });
});
