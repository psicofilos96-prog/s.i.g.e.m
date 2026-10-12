import { describe, it, expect } from "vitest";
import { projectInclusionForOp, opInclusionAccess, opInclusionAct, validateMeeting, concludeProvidence, centralInclusion, type InclusionItem } from "./op-inclusion";
import type { OpDesignation } from "./op-designations";

const it0 = (o: Partial<InclusionItem> = {}): InclusionItem => ({ id: "i1", source: "nei-orientacao", studentId: "a", classId: "c1", schoolId: "s1", sharedWithOp: true, validFrom: "2026-01-01", validTo: null, text: "Usar material ampliado", clinical: "x", cid: "F84", authorName: "Fulana", confirmedByCompetent: true, ...o });
const ctx = { schoolId: "s1", studentId: "a", date: "2026-10-12" };
const d: OpDesignation = { logicalId: "d", role: "orientador-da-unidade", personId: "op", schoolIds: ["s1"], classIds: null, from: "2026-01-01", to: null, substituteOf: null, history: [] };
const access = { personNatural: true, personId: "op", date: "2026-10-12", schoolId: "s1", classId: "c1", purpose: "intervencao", designations: [d], capabilities: [{ id: "consultar-acompanhamento-pedagogico", scope: "escola" as const, schoolId: "s1" }] };

describe("Lote 13 — educação inclusiva", () => {
  it("projeção mínima: só allowlist, partilhado, vigente, da escola", () => {
    const v = projectInclusionForOp([it0(), it0({ id: "i2", sharedWithOp: false }), it0({ id: "i3", validTo: "2026-05-01" }), it0({ id: "i4", schoolId: "s9" })], ctx);
    expect(v.map((x) => x.id)).toEqual(["i1"]);
    expect(Object.keys(v[0]!).sort()).toEqual(["id", "retained", "source", "text", "validTo"]);
  });
  it("texto clínico retido; estratégia do mediador só confirmada", () => {
    expect(projectInclusionForOp([it0({ text: "laudo indica TEA" })], ctx)[0]!.text).toBe("Conteúdo restrito ao NEI.");
    expect(projectInclusionForOp([it0({ source: "mediador-estrategia", confirmedByCompetent: false })], ctx)).toEqual([]);
  });
  it("acesso contextual: finalidade, capacidade; central e técnico recusados", () => {
    expect(opInclusionAccess(access).ok).toBe(true);
    expect(opInclusionAccess({ ...access, purpose: "formacao" }).ok).toBe(false);
    expect(opInclusionAccess({ ...access, capabilities: [] }).ok).toBe(false);
    expect(opInclusionAccess({ ...access, personNatural: false }).ok).toBe(false);
    const central = { ...access, designations: [{ ...d, role: "coordenacao-central-op" as const, schoolIds: "rede" as const }], capabilities: [{ id: "consultar-acompanhamento-pedagogico", scope: "rede" as const, schoolId: null }] };
    expect(opInclusionAccess(central).ok).toBe(false);
  });
  it("OP articula e não substitui NEI, AEE, professor ou clínico", () => {
    for (const k of ["editar-pei", "editar-paee", "registrar-aee", "definir-adaptacao-pelo-professor", "registrar-diagnostico"] as const) expect(opInclusionAct(k, "x").ok).toBe(false);
    expect(opInclusionAct("solicitacao-ao-nei", "apoio na leitura")).toMatchObject({ ok: true, channel: "protocolo-nei" });
    expect(opInclusionAct("providencia-escolar", "rampa na sala 3")).toMatchObject({ ok: true, channel: "solicitacao-escola" });
    expect(opInclusionAct("orientar-professor", "suspeita de TDAH").ok).toBe(false);
  });
  it("reunião e providência", () => {
    expect(validateMeeting({ id: "m", on: "2026-10-20", participants: [{ personId: "op", role: "orientacao" }, { personId: "f", role: "familia" }], agenda: "rotina", studentRefs: ["a"] }, { familyAuthorized: false })).toHaveLength(1);
    expect(validateMeeting({ id: "m", on: "x", participants: [{ personId: "op", role: "orientacao" }, { personId: "p", role: "professor" }], agenda: "medicação", studentRefs: [] }, { familyAuthorized: true })).toHaveLength(1);
    expect(concludeProvidence({ ownerSector: "nei", actorSector: "orientacao", ownerRecordRef: "r" }).ok).toBe(false);
    expect(concludeProvidence({ ownerSector: "nei", actorSector: "nei", ownerRecordRef: null }).ok).toBe(false);
    expect(concludeProvidence({ ownerSector: "nei", actorSector: "nei", ownerRecordRef: "r" }).ok).toBe(true);
  });
  it("central só contagens suprimidas", () => {
    expect(centralInclusion({ meetings: 3, requests: 12 })).toEqual({ meetings: "suprimido", requests: 12 });
  });
});
