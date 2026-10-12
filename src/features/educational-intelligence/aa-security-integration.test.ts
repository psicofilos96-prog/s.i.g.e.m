import { describe, it, expect } from "vitest";
import { authorize, auditEvent, INTEGRATIONS, PROPOSED_ROLES, CAP_FOR, type Grant, type Request } from "./aa-security-integration";

const allocations = [{ studentId: "s1", classId: "t1", schoolId: "e1", from: "2026-02-01", to: "2026-06-30" }];
const req = (extra: Partial<Request>): Request => ({ data: "agregado", at: "2026-04-01", target: { schoolId: "e1" }, purpose: null, allocations, ...extra });
const g = (capability: string, level: Grant["level"], scopeIds: string[]): Grant => ({ capability, level, scopeIds, validFrom: "2026-01-01", validTo: null });

describe("A&A L18 segurança e integração", () => {
  it("sem política homologada nada vale; escopo por escola", () => {
    expect(authorize([g(CAP_FOR.agregado, "rede", [])], req({}), false).ok).toBe(false);
    expect(authorize([g(CAP_FOR.agregado, "escola", ["e2"])], req({}), true).ok).toBe(false);
    expect(authorize([g(CAP_FOR.agregado, "escola", ["e1"])], req({}), true).ok).toBe(true);
  });
  it("docente por turma vê só estudante alocado na data; família só com vínculo vigente", () => {
    const doc = [g(CAP_FOR.nominal, "turma", ["t1"])];
    expect(authorize(doc, req({ data: "nominal", target: { schoolId: "e1", studentId: "s1" }, purpose: "planejar" }), true).ok).toBe(true);
    expect(authorize(doc, req({ data: "nominal", at: "2026-08-01", target: { schoolId: "e1", studentId: "s1" }, purpose: "planejar" }), true).ok).toBe(false);
    expect(authorize(doc, req({ data: "nominal", target: { schoolId: "e1", studentId: "s1" }, purpose: null }), true).ok).toBe(false);
    const fam = [g(CAP_FOR.nominal, "alocacao", ["s1"])];
    expect(authorize(fam, req({ data: "nominal", target: { schoolId: "e1", studentId: "s1" }, purpose: "acompanhar filho" }), true).ok).toBe(true);
    expect(authorize(fam, req({ data: "nominal", target: { schoolId: "e1", studentId: "s2" }, purpose: "x" }), true).ok).toBe(false);
  });
  it("integrações só leem; auditoria exige pessoa, hash, finalidade ou motivo", () => {
    expect(INTEGRATIONS.every(i => !i.writes)).toBe(true);
    expect(Object.keys(PROPOSED_ROLES)).toHaveLength(10);
    expect(auditEvent({ kind: "exportacao", actorPersonId: "p", at: "x", objectRef: "r", purpose: null, reason: null, sha256: "a".repeat(64) })).toHaveProperty("refused");
    expect(auditEvent({ kind: "correcao", actorPersonId: "p", at: "x", objectRef: "r", purpose: null, reason: "", sha256: null })).toHaveProperty("refused");
    const ok = auditEvent({ kind: "publicacao", actorPersonId: "p", at: "x", objectRef: "r", purpose: null, reason: null, sha256: "b".repeat(64) });
    expect(ok).toHaveProperty("idempotencyKey");
  });
});
