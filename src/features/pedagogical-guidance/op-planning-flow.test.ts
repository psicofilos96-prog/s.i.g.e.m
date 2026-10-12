import { describe, it, expect } from "vitest";
import { projectFlow, planOpAction, teacherMaySubmit, flowTimeline, type FlowInput } from "./op-planning-flow";
import type { OpDesignation } from "./op-designations";

const v = (seq: number, at: string, author = "prof") => ({ versionId: `v${seq}`, seq, authorPersonId: author, recordedAt: at, contentHash: `h${seq}` });
const base = (o: Partial<FlowInput> = {}): FlowInput => ({ planId: "p1", authorPersonId: "prof", versions: [v(1, "2026-10-01")], reviews: [], feedback: [], submissionRequired: true, validation: null, validations: [], executionStartedOn: null, ...o });
const sent = { seq: 1, event: "enviado" as const, subject_version_id: "v1", comment: null, by_author: true, recorded_at: "2026-10-02" };
const desig: OpDesignation = { logicalId: "d1", role: "orientador-da-unidade", personId: "op", schoolIds: ["s1"], classIds: null, from: "2026-01-01", to: null, substituteOf: null, history: [] };
const access = { personNatural: true, date: "2026-10-05", schoolId: "s1", classId: "c1", purpose: "acompanhamento", designations: [desig], capabilities: [{ id: "registrar-acompanhamento-pedagogico", scope: "escola" as const, schoolId: "s1" }] };
const act = (flow: FlowInput, action: any, extra: any = {}) => planOpAction({ flow, action, actorPersonId: "op", actorCapabilities: [], access, expectedSeq: 0, idempotencyKey: "k", seenKeys: [], ...extra });

describe("Lote 06 — fluxo de planejamento", () => {
  it("percorre elabora → análise → ajuste → revisão", () => {
    expect(projectFlow(base()).stage).toBe("elaboracao");
    expect(projectFlow(base({ reviews: [sent] })).stage).toBe("em-analise");
    const adj = { ...sent, seq: 2, event: "ajuste-solicitado" as const, by_author: false, comment: "rever", recorded_at: "2026-10-03" };
    expect(projectFlow(base({ reviews: [sent, adj] })).stage).toBe("ajuste-solicitado");
    expect(projectFlow(base({ reviews: [sent, adj], versions: [v(1, "2026-10-01"), v(2, "2026-10-04")] })).stage).toBe("em-revisao");
  });
  it("sem regra homologada exigindo envio, a OP acompanha sem portão", () => {
    expect(projectFlow(base({ submissionRequired: null, executionStartedOn: "2026-10-06" })).stage).toBe("em-execucao");
  });
  it("validação só quando prevista, por pessoa ≠ autor com capacidade e fundamentação", () => {
    const ok = { ...sent, seq: 2, event: "aprovado" as const, by_author: false };
    const f = base({ reviews: [sent, ok], validation: { required: true, capability: "validar-planejamento" } });
    expect(projectFlow(f).stage).toBe("aguardando-validacao");
    expect(act(f, { kind: "validar", reason: "ok" }).ok).toBe(false);
    expect(act(f, { kind: "validar", reason: "ok" }, { actorCapabilities: ["validar-planejamento"] }).ok).toBe(true);
    expect(act(f, { kind: "validar", reason: " " }, { actorCapabilities: ["validar-planejamento"] }).ok).toBe(false);
    expect(act(base({ reviews: [sent, ok] }), { kind: "validar", reason: "x" }, { actorCapabilities: ["validar-planejamento"] }).ok).toBe(false);
    const done = { ...f, validations: [{ seq: 1, versionId: "v1", validatorPersonId: "op", at: "2026-10-05", decision: "validado" as const, reason: "ok" }], executionStartedOn: "2026-10-06" };
    expect(projectFlow(done).stage).toBe("em-execucao");
  });
  it("orientador nunca sobrescreve conteúdo nem autoria", () => {
    expect(act(base({ reviews: [sent] }), { kind: "editar-conteudo" }).ok).toBe(false);
    const p = projectFlow(base({ versions: [v(1, "2026-10-01"), v(2, "2026-10-02", "op")] }));
    expect(p.stage).toBe("inconsistente");
    expect(projectFlow(base({ feedback: [{ seq: 1, planVersionId: "v1", authorId: "op", at: "2026-10-02", kind: "resposta", text: "x" }] })).stage).toBe("inconsistente");
  });
  it("pedido de ajuste exige comentário, envio pendente e base esperada", () => {
    expect(act(base({ reviews: [sent] }), { kind: "solicitar-ajuste", text: "" }).ok).toBe(false);
    expect(act(base(), { kind: "solicitar-ajuste", text: "rever" }).ok).toBe(false);
    expect(act(base({ reviews: [sent] }), { kind: "solicitar-ajuste", text: "rever" }).ok).toBe(false);
    expect(act(base({ reviews: [sent] }), { kind: "solicitar-ajuste", text: "rever" }, { expectedSeq: 1 }).ok).toBe(true);
  });
  it("fail-closed e idempotente: executor técnico, autor e central são recusados", () => {
    const f = base({ reviews: [sent] });
    expect(act(f, { kind: "comentar", text: "x" }, { access: { ...access, personNatural: false } }).ok).toBe(false);
    expect(act(f, { kind: "comentar", text: "x" }, { actorPersonId: "prof" }).ok).toBe(false);
    expect(act(f, { kind: "comentar", text: "x" }, { access: { ...access, designations: [{ ...desig, role: "coordenacao-central-op", schoolIds: "rede" }] } }).ok).toBe(false);
    expect(act(f, { kind: "comentar", text: "x" }, { seenKeys: ["k"], access: { ...access, capabilities: [] } })).toMatchObject({ ok: true, duplicate: true });
  });
  it("professor reenvia só a própria versão atual; histórico versiona tudo", () => {
    expect(teacherMaySubmit(base(), "prof")).toBe(true);
    expect(teacherMaySubmit(base({ reviews: [sent] }), "prof")).toBe(false);
    expect(teacherMaySubmit(base(), "op")).toBe(false);
    const t = flowTimeline(base({ reviews: [sent], feedback: [{ seq: 1, planVersionId: "v1", authorId: "op", at: "2026-10-03", kind: "devolutiva", text: "x" }] }));
    expect(t.map((x) => x.versionId)).toEqual(["v1", "v1", "v1"]);
  });
});
