import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { acceptanceMatrix, GLOBAL_BLOCKERS } from "./op-acceptance";
import { OP_SECTIONS, opScope } from "./op-unit-architecture";
import { projectOpDesignations, decideOpAccess, aggregateForCentral, type OpDesignationEvent, type OpAccessRequest } from "./op-designations";
import { canOpWrite, guardPurpose, isolateSchool, auditEvent } from "./op-integration";
import { guardRecoveryText } from "./op-recovery";

// Fixtures sintéticas: orientador A (oA), orientador B (oB), central (c1), docente, direção, NEI, A&A.
const ev = (o: Partial<OpDesignationEvent> & Pick<OpDesignationEvent, "id" | "logicalId" | "seq">): OpDesignationEvent => ({
  kind: "designar", role: "orientador-da-unidade", personId: "oA", engagementId: "g", schoolIds: ["sA"], classIds: null,
  from: "2026-02-01", to: null, substituteOf: null, reason: null, actorPersonId: "dir", ...o,
});
const { list } = projectOpDesignations([
  ev({ id: "1", logicalId: "A", seq: 1 }),
  ev({ id: "2", logicalId: "B", seq: 1, personId: "oB", schoolIds: ["sB"] }),
  ev({ id: "3", logicalId: "C", seq: 1, role: "coordenacao-central-op", personId: "c1", schoolIds: "rede" }),
]);
const caps = (s: string) => [{ id: "consultar-acompanhamento-pedagogico", scope: "escola" as const, schoolId: s }, { id: "registrar-acompanhamento-pedagogico", scope: "escola" as const, schoolId: s }];
const req = (o: Partial<OpAccessRequest>): OpAccessRequest => ({ personNatural: true, personId: "oA", date: "2026-04-01", schoolId: "sA", classId: "5A",
  granularity: "individual", action: "registrar", purpose: "acompanhamento", designations: list, capabilities: caps("sA"), ...o });

describe("OP L22 — aceite integrado (fixtures sintéticas)", () => {
  it("isolamento A × B e central só consulta agregado", () => {
    expect(decideOpAccess(req({})).ok).toBe(true);
    expect(decideOpAccess(req({ schoolId: "sB", capabilities: caps("sA") })).ok).toBe(false);
    expect(decideOpAccess(req({ personId: "oB", schoolId: "sA", capabilities: caps("sB") })).ok).toBe(false);
    expect(decideOpAccess(req({ personId: "c1", capabilities: [] })).ok).toBe(false);
    expect(decideOpAccess(req({ personId: "c1", capabilities: [], action: "consultar", granularity: "agregado", classId: null })).ok).toBe(true);
    expect(isolateSchool("sB", ["sA"]).ok).toBe(false);
    expect(isolateSchool("sA", null).ok).toBe(false);
  });
  it("executor técnico nunca pratica ato pedagógico (fail-closed)", () => {
    expect(decideOpAccess(req({ personNatural: false })).ok).toBe(false);
    expect(opScope({ personNatural: false, grants: [], date: "2026-04-01" }, "consultar", "sA").ok).toBe(false);
  });
  it("OP não escreve fatos de docente, direção, NEI, A&A; fiscalização vai à Supervisão", () => {
    expect(canOpWrite("docente", "nota").ok).toBe(false);
    expect(canOpWrite("nei", "laudo").ok).toBe(false);
    expect(guardPurpose("vistoria do ponto do servidor")).not.toBeNull();
    expect(guardPurpose("devolutiva formativa do planejamento")).toBeNull();
  });
  it("LGPD: agregado suprime 1–4, ausência não vira zero, auditoria sem texto livre", () => {
    expect(aggregateForCentral({ a: 3, b: 0, c: null, d: 12 })).toEqual({ a: "suprimido", b: 0, c: "não disponível", d: 12 });
    const r = auditEvent({ action: "exportacao", resource: "relatorio", studentName: "Fulano", at: "2026-04-01" });
    expect(r.ok && JSON.stringify(r.event).includes("Fulano")).toBe(false);
  });
  it("recuperação nunca decide trajetória", () => expect(guardRecoveryText("aluno retido no ano")).not.toBeNull());

  const rows = acceptanceMatrix((p) => existsSync(p));
  it("matriz cobre as 34 seções, sem arquivo de evidência ausente", () => {
    expect(rows.map((r) => r.n)).toEqual(OP_SECTIONS.map((s) => s.n));
    expect(rows).toHaveLength(34);
    expect(rows.filter((r) => r.blockers.some((b) => b.startsWith("Arquivo ausente")))).toEqual([]);
  });
  it("nenhuma seção declara homologação institucional; bloqueadas seguem bloqueadas", () => {
    expect(rows.every((r) => r.institutionalHomologation === false)).toBe(true);
    expect(rows.filter((r) => r.status === "bloqueado").map((r) => r.n)).toEqual([4, 29]);
    expect(GLOBAL_BLOCKERS.length).toBeGreaterThan(0);
  });
});
