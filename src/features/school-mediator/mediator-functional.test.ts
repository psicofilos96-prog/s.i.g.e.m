/**
 * LOTE 19 — cenário funcional e de segurança com fixtures sintéticas em memória
 * (nada persiste; equivale a rollback). Personas: mediador escola A/B, profissional de apoio,
 * acompanhante especializado, docente, NEI, direção.
 */
import { describe, it, expect } from "vitest";
import { projectDesignations, type MediationRow, type EngagementRef } from "./mediator-designations";
import type { FunctionConfig } from "./mediator-architecture";
import { decideAccess, type AccessRequest, type Principal } from "./mediator-access-policy";
import { guardAutomationOutput, reportFromRecords } from "./mediator-automation";

const eng: EngagementRef[] = [
  { id: "gMA", personId: "medA", schoolId: "sA", from: "2026-02-01", to: null },
  { id: "gMB", personId: "medB", schoolId: "sB", from: "2026-02-01", to: null },
  { id: "gAP", personId: "apoio", schoolId: "sA", from: "2026-02-01", to: null },
  { id: "gAE", personId: "acomp", schoolId: "sA", from: "2026-02-01", to: null },
  { id: "gDO", personId: "docente", schoolId: "sA", from: "2026-02-01", to: null },
  { id: "gNE", personId: "nei", schoolId: "sA", from: "2026-02-01", to: null },
  { id: "gDI", personId: "direcao", schoolId: "sA", from: "2026-02-01", to: null },
];
const r = (o: Partial<MediationRow> & Pick<MediationRow, "id" | "logical_id" | "version" | "mediator_engagement_id">): MediationRow => ({
  supersedes_id: null, event_kind: "registro", school_id: "sA", student_id: "e1", class_id: "5A", valid_from: "2026-02-01", valid_to: null, reason: null, ...o,
});
const rows: MediationRow[] = [
  r({ id: "1", logical_id: "MA", version: 1, mediator_engagement_id: "gMA" }),
  r({ id: "2", logical_id: "MA", version: 2, supersedes_id: "1", event_kind: "retificacao", class_id: "5B", mediator_engagement_id: "gMA" }),
  r({ id: "3", logical_id: "MB", version: 1, school_id: "sB", student_id: "e7", mediator_engagement_id: "gMB" }),
  r({ id: "4", logical_id: "AP", version: 1, mediator_engagement_id: "gAP" }),
  r({ id: "5", logical_id: "AE", version: 1, student_id: "e2", mediator_engagement_id: "gAE" }),
  r({ id: "6", logical_id: "AE", version: 2, supersedes_id: "5", event_kind: "encerramento", student_id: "e2", valid_to: "2026-04-30", mediator_engagement_id: "gAE" }),
];
const fnOf = (l: string) => ({ MA: "mediador-escolar", MB: "mediador-escolar", AP: "profissional-de-apoio-escolar", AE: "acompanhante-especializado" } as Record<string, string>)[l] ?? null;
const cfg = (functionId: string, competences: string[]): FunctionConfig => ({ functionId, label: functionId, competences, homologated: true, source: "fixture", validFrom: "2026-01-01", validTo: null });
const configs = [
  cfg("mediador-escolar", ["ler-ficha", "ler-orientacao", "registrar-apoio", "registrar-ocorrencia"]),
  cfg("profissional-de-apoio-escolar", ["registrar-apoio"]),
  cfg("acompanhante-especializado", ["ler-ficha", "registrar-apoio"]),
];
const { designations, rejected } = projectDesignations(rows, eng, fnOf);
const person = (id: string): Principal => ({ kind: "pessoa", accountId: `acc-${id}`, personId: id, authenticated: true });
const req = (who: string, o: Partial<AccessRequest>): AccessRequest => ({
  principal: person(who), schoolId: "sA", studentId: "e1", date: "2026-03-10", dataKind: "registro-diario", purpose: "registro", action: "ler",
  designations, engagements: eng, configs, ...o,
});
const allow = (who: string, o: Partial<AccessRequest> = {}) => decideAccess(req(who, o)).allow;

describe("Mediador L19 — cenário funcional e segurança", () => {
  it("cadeias válidas; mudança de turma preservada", () => {
    expect(rejected).toEqual([]);
    expect(designations.find((d) => d.logicalId === "MA")?.classId).toBe("5B");
  });
  it("mediador A não alcança escola B nem estudante de B (acesso entre escolas/estudantes)", () => {
    expect(allow("medA")).toBe(true);
    expect(allow("medA", { schoolId: "sB", studentId: "e7" })).toBe(false);
    expect(allow("medB", { schoolId: "sA", studentId: "e1" })).toBe(false);
    expect(allow("medA", { studentId: "e2" })).toBe(false);
  });
  it("funções não herdam competência entre si", () => {
    expect(allow("apoio")).toBe(true);
    expect(allow("apoio", { dataKind: "ocorrencia" })).toBe(false);
    expect(allow("apoio", { dataKind: "identificacao-escolar", purpose: "acompanhamento" })).toBe(false);
  });
  it("revogação temporal do acompanhante", () => {
    expect(allow("acomp", { studentId: "e2", date: "2026-04-30" })).toBe(true);
    expect(allow("acomp", { studentId: "e2", date: "2026-05-01" })).toBe(false);
  });
  it("docente, NEI e direção não operam como mediador sem designação", () => {
    for (const p of ["docente", "nei", "direcao"]) expect(allow(p)).toBe(false);
  });
  it("laudo/prontuário negados a todas as personas, inclusive por URL/API forjada", () => {
    for (const p of ["medA", "apoio", "acomp", "docente", "nei", "direcao"]) for (const k of ["laudo", "prontuario", "texto-clinico"])
      expect(allow(p, { dataKind: k, purpose: "acompanhamento", attachmentGrant: { studentId: "e1", until: "2099-12-31" } })).toBe(false);
  });
  it("exportação só por relatório, e relatório só conta registros", () => {
    expect(allow("medA", { action: "exportar" })).toBe(false);
    expect(allow("medA", { action: "exportar", purpose: "relatorio" })).toBe(true);
    expect(reportFromRecords(null).ok).toBe(false);
    expect(guardAutomationOutput("relatorio-de-registros", "Aluno regrediu").ok).toBe(false);
  });
  it("executor técnico com personId de mediador não age como pessoa", () => {
    expect(decideAccess(req("medA", { principal: { kind: "executor-tecnico", accountId: "svc", personId: "medA", authenticated: true } })).allow).toBe(false);
  });
});
