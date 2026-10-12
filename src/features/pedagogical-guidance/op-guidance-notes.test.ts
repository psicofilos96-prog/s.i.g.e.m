import { describe, it, expect } from "vitest";
import { recordNoteEvent, projectNotes, notificationFor, noteTasks, notesFor, type NoteEvent, type NoteCommand } from "./op-guidance-notes";
import type { OpDesignation } from "./op-designations";

const d: OpDesignation = { logicalId: "d", role: "orientador-da-unidade", personId: "op1", schoolIds: ["s1"], classIds: null, from: "2026-01-01", to: null, substituteOf: null, history: [] };
const reg: NoteEvent = { id: "e1", logicalId: "n1", seq: 1, kind: "registrar", actorPersonId: "op1", at: "t1", idempotencyKey: "k1", schoolId: "s1",
  recipientPersonId: "prof1", recipientEngagementId: "eng-prof1", subject: "Sequência de leitura", context: "3º A", basis: "Plano do bimestre", documentRefs: ["doc1"] };
const ev = (seq: number, kind: NoteEvent["kind"], actor: string, x: Partial<NoteEvent> = {}): NoteEvent => ({ id: `e${seq}`, logicalId: "n1", seq, kind, actorPersonId: actor, at: `t${seq}`, idempotencyKey: `k${seq}`, ...x });
const cmd = (event: NoteEvent, existing: NoteEvent[] = [], o: Partial<NoteCommand> = {}): NoteCommand => ({ personNatural: true, personId: event.actorPersonId, today: "2026-04-01", event, expectedSeq: existing.length, existing,
  designations: [d], capabilities: [{ id: "registrar-acompanhamento-pedagogico", scope: "escola", schoolId: "s1" }], activeEngagementsAtSchool: new Map([["eng-prof1", "prof1"], ["eng-op1", "op1"]]), ...o });

const flow = [reg, ev(2, "enviar", "op1"), ev(3, "ciencia", "prof1"), ev(4, "providencia", "op1", { actionId: "a1", actionText: "Rever rotina", responsibleEngagementId: "eng-prof1", dueOn: "2026-04-20" }),
  ev(5, "devolutiva", "prof1", { text: "Ajustei a rotina" }), ev(6, "acompanhamento", "op1", { text: "Observado avanço" }), ev(7, "encerrar", "op1", { reason: "Objetivo atendido" })];

describe("OP Lote 18 — orientações e devolutivas", () => {
  it("fluxo completo registro→envio→ciência→providência→devolutiva→acompanhamento→encerramento", () => {
    flow.forEach((e, i) => expect(recordNoteEvent(cmd(e, flow.slice(0, i))).ok).toBe(true));
    const v = projectNotes(flow).list[0]!;
    expect(v.status).toBe("encerrada"); expect(v.functionalEffect).toBe(false); expect(v.history).toHaveLength(7);
  });
  it("idempotência e base esperada", () => {
    expect(recordNoteEvent(cmd(reg, [reg]))).toMatchObject({ ok: true, replay: true });
    expect(recordNoteEvent(cmd(flow[2]!, flow.slice(0, 2), { expectedSeq: 1 })).ok).toBe(false);
  });
  it("ciência e devolutiva só pelo destinatário; envio só pelo autor; não pular etapas", () => {
    expect(recordNoteEvent(cmd(ev(3, "ciencia", "op1"), flow.slice(0, 2))).ok).toBe(false);
    expect(recordNoteEvent(cmd(ev(2, "enviar", "prof1"), [reg])).ok).toBe(false);
    expect(recordNoteEvent(cmd(ev(2, "devolutiva", "prof1", { text: "x" }), [reg])).ok).toBe(false);
  });
  it("fail-closed: executor técnico, central, destinatário sem atuação, autoorientação", () => {
    expect(recordNoteEvent(cmd(reg, [], { personNatural: false })).ok).toBe(false);
    expect(recordNoteEvent(cmd(reg, [], { designations: [{ ...d, role: "coordenacao-central-op", schoolIds: "rede" }] })).ok).toBe(false);
    expect(recordNoteEvent(cmd(reg, [], { activeEngagementsAtSchool: new Map() })).ok).toBe(false);
    expect(recordNoteEvent(cmd({ ...reg, recipientPersonId: "op1", recipientEngagementId: "eng-op1" })).ok).toBe(false);
  });
  it("comunicação formativa nunca vira punição", () => {
    expect(recordNoteEvent(cmd({ ...reg, subject: "Advertência por atraso" })).ok).toBe(false);
    expect(recordNoteEvent(cmd(ev(7, "encerrar", "op1", { reason: "Abrir PAD" }), flow.slice(0, 6))).ok).toBe(false);
    expect(recordNoteEvent(cmd(ev(7, "encerrar", "op1"), flow.slice(0, 6))).ok).toBe(false);
  });
  it("notificação idempotente sem conteúdo; providência vira tarefa com dedupe estável", () => {
    const v = projectNotes(flow).list[0]!;
    const n = notificationFor(v, flow[1]!)!;
    expect(n).toMatchObject({ eventKind: "op.orientacao.enviada", recipientPersonId: "prof1", idempotencyKey: "op-orientacao:n1:2", variables: {} });
    expect(JSON.stringify(n)).not.toMatch(/Sequência|leitura/);
    expect(notificationFor(v, flow[4]!)!.recipientPersonId).toBe("op1");
    expect(noteTasks(v)[0]!.dedupeKey).toBe("fonte:op-orientacao:n1:a1:s1");
  });
  it("leitura: só autor e destinatário; central só contagem suprimida", () => {
    const l = projectNotes(flow).list;
    expect(notesFor({ kind: "pessoa", personId: "prof2" }, l)).toEqual([]);
    expect(notesFor({ kind: "pessoa", personId: "prof1" }, l)).toHaveLength(1);
    expect((notesFor({ kind: "central" }, l) as any).encerrada).toBe("suprimido");
  });
});
