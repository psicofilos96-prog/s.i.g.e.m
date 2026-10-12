import { describe, expect, it } from "vitest";
import { checkMovement, checkSchoolRequest, dedupeRequests, MOVEMENT_STAGES, movementHistory, movementStage, protocolOf, REQUEST_TO_MOVEMENT, type MCaps, type MEvent, type SchoolRequest } from "./movement-requests";

const caps: MCaps = Object.fromEntries(MOVEMENT_STAGES.map((s) => [`lotacao:${s}`, `mov-${s}`]));
const ev = (seq: number, stage: MEvent["stage"], o: Partial<MEvent> = {}): MEvent => ({
  movementId: "M1", version: 1, seq, kind: "lotacao", stage, payloadHash: "h1", authorUserId: "u1", authorPersonId: "PA", technical: false,
  capabilityExercised: ["devolucao", "indeferimento", "retificacao"].includes(stage) ? null : `mov-${stage}`, recordedAt: `2026-03-0${seq}`, ...o,
});
const flow = [ev(1, "solicitacao"), ev(2, "analise"), ev(3, "validacao", { authorPersonId: "PB" }), ev(4, "ato", { authorPersonId: "PB", actRef: "port-9" }), ev(5, "aplicacao", { appliedFactRef: "placement:p77" })];

describe("movimentações", () => {
  it("fluxo completo na ordem", () => {
    flow.forEach((e, i) => expect(checkMovement(e, flow.slice(0, i), caps)).toBeNull());
    expect(movementHistory(flow).currentApplied?.appliedFactRef).toBe("placement:p77");
  });
  it("não pula etapa, exige capacidade, ato, fato aplicado e validador ≠ solicitante", () => {
    expect(checkMovement(ev(2, "validacao", { authorPersonId: "PB" }), flow.slice(0, 1), caps)).toBe("etapa-fora-de-ordem");
    expect(checkMovement(ev(1, "solicitacao", { kind: "designacao" }), [], caps)).toBe("sem-capacidade");
    expect(checkMovement(ev(3, "validacao"), flow.slice(0, 2), caps)).toBe("validador-e-solicitante");
    expect(checkMovement(ev(4, "ato", { authorPersonId: "PB" }), flow.slice(0, 3), caps)).toBe("sem-ato");
    expect(checkMovement(ev(5, "aplicacao"), flow.slice(0, 4), caps)).toBe("sem-fato-aplicado");
    expect(checkMovement(ev(2, "analise", { technical: true }), flow.slice(0, 1), caps)).toBe("executor-tecnico");
  });
  it("conteúdo não pode mudar durante o fluxo", () => {
    expect(checkMovement(ev(2, "analise", { payloadHash: "h2" }), flow.slice(0, 1), caps)).toBe("conteudo-alterado");
  });
  it("aplicada é imutável; retificação é nova versão com motivo", () => {
    expect(checkMovement(ev(6, "analise"), flow, caps)).toBe("finalizada");
    expect(checkMovement(ev(6, "retificacao", { version: 2 }), flow, caps)).toBe("sem-motivo");
    const ret = ev(6, "retificacao", { version: 2, reason: "data do ato errada", payloadHash: "h2" });
    expect(checkMovement(ret, flow, caps)).toBeNull();
    expect(movementStage([...flow, ret])).toBe("analise");
    expect(checkMovement(ev(4, "retificacao", { reason: "x" }), flow.slice(0, 3), caps)).toBe("retificacao-sem-aplicacao");
  });
  it("indeferimento exige motivo e encerra", () => {
    const ind = ev(2, "indeferimento", { reason: "sem vaga" });
    expect(checkMovement(ind, flow.slice(0, 1), caps)).toBeNull();
    expect(checkMovement(ev(3, "analise"), [flow[0]!, ind], caps)).toBe("finalizada");
  });
});

const sr = (o: Partial<SchoolRequest> = {}): SchoolRequest => ({ schoolId: "E1", kind: "professor", subjectRef: "T1/MAT", justification: "Turma sem professor de matemática desde março.", requestedByUserId: "u5", technical: false, idempotencyKey: "k1", createdAt: "2026-03-05", ...o });

describe("solicitações das escolas", () => {
  it("válida e com protocolo idempotente", () => {
    expect(checkSchoolRequest(sr())).toBeNull();
    expect(protocolOf(sr())).toBe(protocolOf(sr({ justification: "outro texto qualquer aqui" })));
    expect(protocolOf(sr())).not.toBe(protocolOf(sr({ idempotencyKey: "k2" })));
    expect(protocolOf(sr())).toMatch(/^GP-2026-/);
    expect(dedupeRequests([sr(), sr()])).toHaveLength(1);
  });
  it("recusa sem autor, técnico, sem justificativa ou com dado sensível", () => {
    expect(checkSchoolRequest(sr({ requestedByUserId: null }))).toBe("sem-autor");
    expect(checkSchoolRequest(sr({ technical: true }))).toBe("executor-tecnico");
    expect(checkSchoolRequest(sr({ justification: "urgente" }))).toBe("sem-justificativa");
    expect(checkSchoolRequest(sr({ kind: "mediador", justification: "Aluno com laudo de TEA precisa de apoio" }))).toBe("conteudo-sensivel");
  });
  it("tipos levam à movimentação competente, sem decidir", () => {
    expect(REQUEST_TO_MOVEMENT).toEqual({ professor: "atribuicao", mediador: "designacao", substituicao: "processo-de-substituicao", divergencia: "revisao-de-dado" });
  });
});
