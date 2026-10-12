import { describe, it, expect } from "vitest";
import { decideAccess, minimize, studentRef, type AccessRequest } from "./mediator-access-policy";
import { projectDesignations, type MediationRow, type EngagementRef } from "./mediator-designations";
import type { FunctionConfig } from "./mediator-architecture";

const eng: EngagementRef[] = [{ id: "gA", personId: "m1", schoolId: "sA", from: "2026-02-01", to: null }];
const rows: MediationRow[] = [{ id: "a1", logical_id: "L1", version: 1, supersedes_id: null, event_kind: "registro", school_id: "sA", student_id: "e1", class_id: "5A", mediator_engagement_id: "gA", valid_from: "2026-02-01", valid_to: "2026-06-30", reason: null }];
const { designations } = projectDesignations(rows, eng, () => "mediador-escolar");
const configs: FunctionConfig[] = [{ functionId: "mediador-escolar", label: "M", competences: ["ler-ficha", "ler-orientacao", "registrar-apoio", "registrar-ocorrencia", "ler-anexo"], homologated: true, source: "decisão", validFrom: "2026-01-01", validTo: null }];
const base: AccessRequest = {
  principal: { kind: "pessoa", accountId: "acc1", personId: "m1", authenticated: true },
  schoolId: "sA", studentId: "e1", date: "2026-03-10", dataKind: "registro-diario", purpose: "registro", action: "ler",
  designations, engagements: eng, configs,
};
const ok = (o: Partial<AccessRequest>) => decideAccess({ ...base, ...o }).allow;

describe("Mediador L17 — segurança e LGPD", () => {
  it("caminho legítimo libera", () => expect(ok({})).toBe(true));
  it("executor técnico e anônimo nunca valem como pessoa", () => {
    expect(ok({ principal: { kind: "executor-tecnico", accountId: "svc", personId: "m1", authenticated: true } })).toBe(false);
    expect(ok({ principal: { kind: "anonimo", accountId: null, personId: null, authenticated: false } })).toBe(false);
    expect(ok({ principal: { ...base.principal, authenticated: false } })).toBe(false);
  });
  it("laudo, prontuário e texto clínico negados por padrão; tipo desconhecido também", () => {
    for (const k of ["laudo", "prontuario", "texto-clinico", "qualquer"]) expect(ok({ dataKind: k, purpose: "acompanhamento" })).toBe(false);
  });
  it("escola, estudante e data fora da designação negam", () => {
    expect(ok({ schoolId: "sB" })).toBe(false);
    expect(ok({ studentId: "e9" })).toBe(false);
    expect(ok({ date: "2026-07-01" })).toBe(false);
    expect(ok({ date: "" })).toBe(false);
  });
  it("função sem competência ou sem config homologada nega", () => {
    expect(ok({ configs: [] })).toBe(false);
    expect(ok({ designations: projectDesignations(rows, eng, () => null).designations })).toBe(false);
  });
  it("finalidade precisa justificar o tipo; exportação só por relatório", () => {
    expect(ok({ purpose: "comunicacao-institucional" })).toBe(false);
    expect(ok({ purpose: "" })).toBe(false);
    expect(ok({ action: "exportar" })).toBe(false);
    expect(ok({ action: "exportar", purpose: "relatorio" })).toBe(true);
  });
  it("anexo privado só com concessão NEI vigente do mesmo estudante", () => {
    const a = { dataKind: "anexo-acessibilidade", purpose: "acompanhamento", action: "anexo" as const };
    expect(ok(a)).toBe(false);
    expect(ok({ ...a, attachmentGrant: { studentId: "e2", until: "2026-12-31" } })).toBe(false);
    expect(ok({ ...a, attachmentGrant: { studentId: "e1", until: "2026-03-01" } })).toBe(false);
    expect(ok({ ...a, attachmentGrant: { studentId: "e1", until: "2026-12-31" } })).toBe(true);
  });
  it("toda decisão gera trilha sem ID bruto do estudante", () => {
    const d = decideAccess({ ...base, dataKind: "laudo" }, "2026-03-10T10:00:00Z");
    expect(d.audit).toMatchObject({ allow: false, accountId: "acc1", studentRef: studentRef("e1") });
    expect(JSON.stringify(d.audit)).not.toContain('"e1"');
  });
  it("minimização remove campos fora da allowlist", () => {
    expect(minimize("ocorrencia", { date: "d", fact: "f", cid: "F84", laudo: "x" })).toEqual({ date: "d", fact: "f" });
  });
});
