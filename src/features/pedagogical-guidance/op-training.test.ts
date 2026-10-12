import { describe, it, expect } from "vitest";
import { recordOffering, participation, validateCertificate, hoursOf, demandStatus, trainingsFor, NETWORK_TRAINING_CAP, VALIDATE_TRAINING_CAP, type TrainingOffering } from "./op-training";
import type { OpDesignation } from "./op-designations";

const d = (role: OpDesignation["role"], s: OpDesignation["schoolIds"]): OpDesignation => ({ logicalId: role, role, personId: "op1", schoolIds: s, classIds: null, from: "2026-01-01", to: null, substituteOf: null, history: [] });
const off = (o: Partial<TrainingOffering> = {}): TrainingOffering => ({ logicalId: "f1", version: 1, scope: "escola", ownerSchoolId: "s1", theme: "Alfabetização", objectives: ["Rotina de leitura"], audience: "Professores 1º ano",
  schoolIds: ["s1"], trainerName: "Formadora X", modality: "presencial", sessions: [{ id: "a", date: "2026-03-01", held: true }, { id: "b", date: "2026-03-08", held: true }],
  hours: 8, seats: 2, minAttendancePct: 75, materials: [], demandIds: ["dm1"], authorPersonId: "op1", reason: null, idempotencyKey: "k1", ...o });
const base = (o: any = {}) => ({ personNatural: true, personId: "op1", date: "2026-03-10", offering: off(), existing: [], designations: [d("orientador-da-unidade", ["s1"])],
  capabilities: [{ id: "registrar-acompanhamento-pedagogico", scope: "escola" as const, schoolId: "s1" }], knownDemandIds: new Set(["dm1"]), ...o });

describe("OP Lote 17 — formação continuada", () => {
  it("orientador planeja formação da escola; replay idempotente", () => {
    const r = recordOffering(base()); expect(r.ok).toBe(true);
    expect(recordOffering(base({ existing: [off()] }))).toMatchObject({ ok: true, replay: true });
  });
  it("fail-closed: executor técnico, encontro futuro como realizado, termo funcional, demanda inexistente", () => {
    expect(recordOffering(base({ personNatural: false })).ok).toBe(false);
    expect(recordOffering(base({ offering: off({ sessions: [{ id: "a", date: "2026-04-01", held: true }] }) })).ok).toBe(false);
    expect(recordOffering(base({ offering: off({ objectives: ["Pontuar estágio probatório"] }) })).ok).toBe(false);
    expect(recordOffering(base({ knownDemandIds: new Set() })).ok).toBe(false);
  });
  it("formação da rede exige designação central + capacidade de rede", () => {
    const net = base({ offering: off({ scope: "rede", ownerSchoolId: null, schoolIds: ["s1", "s2"] }), designations: [d("coordenacao-central-op", "rede")] });
    expect(recordOffering(net).ok).toBe(false);
    expect(recordOffering({ ...net, capabilities: [{ id: NETWORK_TRAINING_CAP, scope: "rede", schoolId: null }] }).ok).toBe(true);
  });
  it("nova versão exige motivo e não apaga encontro realizado", () => {
    const v2 = off({ version: 2, idempotencyKey: "k2", sessions: [{ id: "a", date: "2026-03-01", held: true }] });
    expect(recordOffering(base({ existing: [off()], offering: v2 })).ok).toBe(false);
    expect(recordOffering(base({ existing: [off()], offering: { ...v2, reason: "x" } })).ok).toBe(false);
    expect(recordOffering(base({ existing: [off()], offering: { ...off({ version: 2, idempotencyKey: "k3" }), reason: "material" } })).ok).toBe(true);
  });
  it("presença só de inscrito confirmado, marcada pelo condutor; sem marca ⇒ frequência não apurada", () => {
    const enr = [{ personId: "p1", at: "1", state: "inscrita" as const }, { personId: "p2", at: "2", state: "inscrita" as const }, { personId: "p3", at: "3", state: "inscrita" as const }];
    const marks = [{ offeringId: "f1", sessionId: "a", personId: "p1", present: true, markedBy: "op1" }, { offeringId: "f1", sessionId: "b", personId: "p1", present: true, markedBy: "op1" },
      { offeringId: "f1", sessionId: "a", personId: "p2", present: true, markedBy: "intruso" }, { offeringId: "f1", sessionId: "a", personId: "p3", present: true, markedBy: "op1" }];
    const p = participation(off(), enr, marks); expect(p.ok).toBe(true); if (!p.ok) return;
    expect(p.waitlist).toEqual(["p3"]);
    expect(p.people.find((x) => x.personId === "p1")!.attendancePct).toBe(100);
    expect(p.people.find((x) => x.personId === "p2")!.attendancePct).toBeNull();
    expect(participation(off({ seats: null }), enr, marks).ok).toBe(false);
  });
  it("certificado só por validador autorizado ≠ autor/participante; horas só de validados", () => {
    const cap = [{ id: VALIDATE_TRAINING_CAP, scope: "escola" as const, schoolId: "s1" }];
    const v = (o: any) => validateCertificate({ personNatural: true, validatorPersonId: "dir1", offering: off(), capabilities: cap, eligible: { ok: true }, participantPersonId: "p1", ...o });
    expect(v({ validatorPersonId: "op1" }).ok).toBe(false);
    expect(v({ personNatural: false }).ok).toBe(false);
    expect(v({ capabilities: [] }).ok).toBe(false);
    expect(v({ eligible: { ok: false } }).ok).toBe(false);
    const ok = v({}); expect(ok.ok).toBe(true);
    if (ok.ok) expect(hoursOf([ok.certificate])).toBe(8);
  });
  it("demanda atendida só com execução; central só vê rede + contagem suprimida", () => {
    expect(demandStatus([{ id: "dm1", schoolId: "s1", theme: "x", raisedByPersonId: "t", at: "t" }], [off()])[0]!.status).toBe("atendida-com-execucao");
    expect(demandStatus([{ id: "dm1", schoolId: "s1", theme: "x", raisedByPersonId: "t", at: "t" }], [off({ sessions: [{ id: "a", date: "2026-05-01", held: false }] })])[0]!.status).toBe("planejada");
    expect(trainingsFor({ kind: "central" }, [off()])).toEqual({ visible: [], schoolCount: "suprimido" });
  });
});
