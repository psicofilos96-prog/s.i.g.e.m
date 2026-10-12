import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkAssisted, resolveStageFlow, type RepresentationRule } from "./assisted-attendance";

const sql = readFileSync("drizzle/migrations/0474_enr21_assisted_attendance.sql", "utf8");
const H = "a".repeat(64);
const rule: RepresentationRule = { version: 1, selfRepresentationAgeYears: 18, ejaMinAgeYears: 15, homologatedBy: "p1" };
const base = { attendantPersonId: "p", channel: "presencial-secretaria-escolar", requesterPresent: true, requesterAcknowledged: true, evidences: [{ kind: "termo-ciencia-assinado" as const, sha256: H }] };
const offer = { offerId: "o", regime: "semestral" as const, positionKeys: ["f1"] };
const cal = { calendarId: "c", periods: [{ periodId: "s1", from: "2027-02-01", to: "2027-07-10" }, { periodId: "s2", from: "2027-07-26", to: "2027-12-20" }] };

describe("L21 atendimento assistido", () => {
  it("atendente identificado, requerente presente, evidências por hash", () => {
    expect(checkAssisted(base)).toEqual({ ok: true });
    expect(checkAssisted({ ...base, attendantPersonId: null })).toMatchObject({ reason: "sem-pessoa" });
    expect(checkAssisted({ ...base, requesterPresent: false })).toMatchObject({ reason: "requerente-ausente" });
    expect(checkAssisted({ ...base, evidences: [{ kind: "termo-ciencia-assinado", sha256: "x" }] })).toMatchObject({ reason: "evidencia-invalida" });
  });
  it("banco: reusa writers canônicos, atendente = current_person_id, sem anon, append-only", () => {
    expect(sql).toMatch(/public\.enr_submit_application\(/);
    expect(sql).toMatch(/public\.enr_protocol_application\(_app\)/);
    expect(sql).toMatch(/_p uuid := public\.current_person_id\(\)/);
    expect(sql).toMatch(/'atender-inscricao-presencial'/);
    expect(sql).toMatch(/FROM PUBLIC, anon/);
    expect(sql).toMatch(/doc_numbering_append_only/);
    expect(sql).not.toMatch(/requester_person_id|act_as|impersonat/i);
  });
  it("estudante adulto só com regra homologada e idade atingida", () => {
    const i = { stageKind: "eja" as const, requesterKind: "estudante-adulto" as const, birthDate: "2000-01-01", referenceDate: "2027-02-01", offer, calendar: cal };
    expect(resolveStageFlow({ ...i, rule: null })).toMatchObject({ reason: "sem-regra-de-autorrepresentacao" });
    expect(resolveStageFlow({ ...i, rule })).toMatchObject({ ok: true });
    expect(resolveStageFlow({ ...i, birthDate: "2012-01-01", rule })).toMatchObject({ reason: "estudante-nao-autorrepresentavel" });
  });
  it("EJA semestral: janelas do calendário; abaixo da idade homologada recusa", () => {
    const r = resolveStageFlow({ stageKind: "eja", requesterKind: "responsavel", birthDate: "2010-01-01", referenceDate: "2027-02-01", rule, offer, calendar: cal });
    expect(r).toMatchObject({ ok: true });
    expect(resolveStageFlow({ stageKind: "eja", requesterKind: "responsavel", birthDate: "2014-01-01", referenceDate: "2027-02-01", rule, offer, calendar: cal })).toMatchObject({ reason: "abaixo-da-idade-eja" });
    expect(resolveStageFlow({ stageKind: "eja", requesterKind: "responsavel", birthDate: "2010-01-01", referenceDate: "2027-02-01", rule, offer, calendar: null })).toMatchObject({ ok: false });
  });
  it("Educação Infantil: sem regra de agrupamento não classifica; adulto incompatível", () => {
    const i = { stageKind: "educacao-infantil" as const, requesterKind: "responsavel" as const, birthDate: "2024-05-01", referenceDate: "2027-03-31", rule };
    expect(resolveStageFlow(i)).toMatchObject({ reason: "ei-indeterminado" });
    const ei = [{ version: 1, cutoff: "2027-03-31", bands: [{ groupId: "g3", segment: "creche", minMonths: 24, maxMonths: 48 }], actRef: "a", actVerified: true, homologatedBy: "p", validFrom: "2027-01-01", validTo: null }];
    expect(resolveStageFlow({ ...i, eiRules: ei })).toMatchObject({ ok: true, group: { groupId: "g3" } });
    expect(resolveStageFlow({ ...i, requesterKind: "estudante-adulto", birthDate: "2000-01-01", eiRules: ei })).toMatchObject({ reason: "etapa-incompativel-com-requerente" });
  });
});
