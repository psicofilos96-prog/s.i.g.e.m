import { describe, it, expect } from "vitest";
import { recordMeetingEvent, projectMeetings, referralTasks, attendanceSummary, meetingsFor, type MeetingEvent, type MeetingCommand } from "./op-meetings";
import type { OpDesignation } from "./op-designations";

const d = (role: OpDesignation["role"], s: OpDesignation["schoolIds"]): OpDesignation => ({ logicalId: role, role, personId: "op1", schoolIds: s, classIds: null, from: "2026-01-01", to: null, substituteOf: null, history: [] });
const ag: MeetingEvent = { id: "e1", logicalId: "m1", seq: 1, actorPersonId: "op1", idempotencyKey: "k1", reason: null, kind: "agendar", schoolId: "s1", meetingKind: "planejamento-coletivo", date: "2026-04-10", agenda: ["Plano do bimestre"], participantEngagementIds: ["t1", "t2"] };
const cmd = (event: MeetingEvent, existing: MeetingEvent[] = [], o: Partial<MeetingCommand> = {}): MeetingCommand => ({ personNatural: true, personId: "op1", today: "2026-04-10", event, expectedSeq: existing.length,
  designations: [d("orientador-da-unidade", ["s1"])], capabilities: [{ id: "registrar-acompanhamento-pedagogico", scope: "escola", schoolId: "s1" }],
  activeEngagementsAtSchool: new Set(["t1", "t2"]), existing, ...o });
const ev = (seq: number, x: any): MeetingEvent => ({ id: `e${seq}`, logicalId: "m1", seq, actorPersonId: "op1", idempotencyKey: `k${seq}`, reason: null, ...x });

describe("OP Lote 15 — reuniões pedagógicas", () => {
  it("orientador agenda; replay idempotente não duplica", () => {
    expect(recordMeetingEvent(cmd(ag)).ok).toBe(true);
    const r = recordMeetingEvent(cmd(ag, [ag])); expect(r.ok && r.replay).toBe(true);
  });
  it("fail-closed: executor técnico, central, participante sem atuação, pauta clínica", () => {
    expect(recordMeetingEvent(cmd(ag, [], { personNatural: false })).ok).toBe(false);
    expect(recordMeetingEvent(cmd(ag, [], { designations: [d("coordenacao-central-op", "rede")] })).ok).toBe(false);
    expect(recordMeetingEvent(cmd(ag, [], { activeEngagementsAtSchool: new Set(["t1"]) })).ok).toBe(false);
    expect(recordMeetingEvent(cmd({ ...ag, agenda: ["Laudo do aluno X"] })).ok).toBe(false);
  });
  it("presença real: antes da data recusa, não registrada nunca vira ausência", () => {
    const p = ev(2, { kind: "presenca", engagementId: "t1", presence: "presente" });
    expect(recordMeetingEvent(cmd(p, [ag], { today: "2026-04-09" })).ok).toBe(false);
    expect(recordMeetingEvent(cmd(p, [ag])).ok).toBe(true);
    const m = projectMeetings([ag, p]).list[0]!;
    expect(attendanceSummary(m)).toEqual({ invited: 2, registered: 1, present: 1, notRegistered: 1 });
    expect(m.situation).toBe("realizada-sem-ata");
  });
  it("ata versionada: nova versão exige motivo; encerrada é imutável; base esperada", () => {
    const p = ev(2, { kind: "presenca", engagementId: "t1", presence: "presente" });
    const a1 = ev(3, { kind: "ata", minute: { version: 1, agendaCovered: ["Plano do bimestre"], decisions: ["Unificar sequência"], referrals: [{ id: "f1", text: "Enviar sequência", responsibleEngagementId: "t1", dueOn: "2026-04-20" }], closed: false } });
    expect(recordMeetingEvent(cmd(a1, [ag, p])).ok).toBe(true);
    const a2 = ev(4, { kind: "ata", minute: { ...(a1 as any).minute, version: 2, closed: true } });
    expect(recordMeetingEvent(cmd(a2, [ag, p, a1])).ok).toBe(false); // sem motivo
    const a2r = { ...a2, reason: "revisão" } as MeetingEvent;
    expect(recordMeetingEvent(cmd(a2r, [ag, p, a1])).ok).toBe(true);
    expect(recordMeetingEvent(cmd(a2r, [ag, p], { expectedSeq: 2 })).ok).toBe(false);
    const a3 = ev(5, { kind: "ata", reason: "x", minute: { ...(a1 as any).minute, version: 3 } });
    expect(recordMeetingEvent(cmd(a3, [ag, p, a1, a2r])).ok).toBe(false);
    const m = projectMeetings([ag, p, a1, a2r]).list[0]!;
    expect(m.minuteHistory).toHaveLength(2);
    const t = referralTasks(m); expect(t).toHaveLength(1); expect(t[0]!.dedupeKey).toBe("fonte:op-reuniao:m1:f1:s1");
  });
  it("encerrar ata exige responsável por encaminhamento e presença registrada", () => {
    const a = ev(2, { kind: "ata", minute: { version: 1, agendaCovered: [], decisions: [], referrals: [{ id: "f", text: "x", responsibleEngagementId: null, dueOn: null }], closed: true } });
    const r = recordMeetingEvent(cmd(a, [ag])); expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join(" ")).toMatch(/presença|responsável/);
  });
  it("só quem agendou reagenda; reagendar exige motivo", () => {
    expect(recordMeetingEvent(cmd(ev(2, { kind: "reagendar", date: "2026-04-12" }), [ag])).ok).toBe(false);
    expect(recordMeetingEvent(cmd(ev(2, { kind: "reagendar", date: "2026-04-12", reason: "feriado" }), [ag])).ok).toBe(true);
  });
  it("visões: participante só as suas; central só contagens suprimidas", () => {
    const m = projectMeetings([ag]).list;
    expect(meetingsFor({ kind: "participante", engagementId: "t9" }, m)).toEqual([]);
    expect((meetingsFor({ kind: "central" }, m) as any)["planejamento-coletivo"]).toBe("suprimido");
  });
});
