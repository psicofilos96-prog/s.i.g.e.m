import { describe, expect, it } from "vitest";
import { ASSIGNMENT_STAGES, checkAssignmentEvent, historyOf, isEffective, verify, type AEvent, type AssignmentDraft, type CheckContext, type StageCaps } from "./class-assignment-flow";

const draft: AssignmentDraft = { linkLogicalId: "L1", personId: "P1", schoolId: "E1", classId: "T1", componentId: "MAT", classHours: 2, blockIds: ["B1", "B2"], validFrom: "2026-03-02", validUntil: null };
const ctx: CheckContext = {
  offerBlocks: () => ["B1", "B2", "B3"], uncoveredHours: () => 3, qualified: () => true, freeMinutes: () => 600,
  minutesPerClassHour: () => 50, exercisingAt: () => true, personBusyBlocks: () => [],
};
const caps: StageCaps = Object.fromEntries(ASSIGNMENT_STAGES.map((s) => [s, `atr-${s}`]));
const ev = (seq: number, stage: AEvent["stage"], o: Partial<AEvent> = {}): AEvent => ({
  assignmentId: "AT1", seq, stage, authorUserId: "u1", authorPersonId: "PA", technical: false,
  capabilityExercised: stage === "devolucao" || stage === "cancelamento" ? null : `atr-${stage}`, recordedAt: "2026-03-01", ...o,
});

describe("verificações", () => {
  it("atribuição consistente não tem pendências", () => expect(verify("AT1", draft, ctx)).toEqual([]));
  it("oferta, habilitação, jornada, exercício e sobreposição", () => {
    const bad: CheckContext = { ...ctx, offerBlocks: () => ["B1"], qualified: () => false, freeMinutes: () => 60, exercisingAt: () => false, personBusyBlocks: () => ["B2"], uncoveredHours: () => 1 };
    expect(verify("AT1", draft, bad).sort()).toEqual(["excede-descobertas", "excede-jornada", "fora-da-oferta", "sem-exercicio-na-escola", "sem-habilitacao", "sobreposicao-de-horario"]);
  });
  it("fonte ausente é pendência explícita, nunca aprovação", () => {
    const none: CheckContext = { ...ctx, offerBlocks: () => null, uncoveredHours: () => null, qualified: () => null, freeMinutes: () => null, exercisingAt: () => null };
    expect(verify("AT1", draft, none).sort()).toEqual(["descobertas-indeterminadas", "exercicio-sem-fonte", "grade-nao-lida", "habilitacao-sem-fonte", "jornada-indeterminada"]);
    expect(verify("AT1", { ...draft, classHours: 3 }, ctx)).toContain("quantidade-difere-dos-blocos");
  });
});

describe("fluxo", () => {
  const flow = [ev(1, "proposta", { draft }), ev(2, "analise"), ev(3, "validacao", { authorPersonId: "PB" }), ev(4, "formalizacao", { authorPersonId: "PB", actRef: "port-7" }), ev(5, "vigencia")];
  it("fluxo completo e vigência", () => {
    flow.forEach((e, i) => expect(checkAssignmentEvent(e, flow.slice(0, i), caps, ctx).refusal).toBeNull());
    expect(isEffective(flow, "2026-03-10")).toBe(true);
    expect(isEffective(flow.slice(0, 4), "2026-03-10")).toBe(false);
    expect(historyOf(flow).map((h) => h.stage)).toEqual(["proposta", "analise", "validacao", "formalizacao", "vigencia"]);
  });
  it("validação refaz verificações e recusa com pendência", () => {
    const r = checkAssignmentEvent(ev(3, "validacao", { authorPersonId: "PB" }), flow.slice(0, 2), caps, { ...ctx, qualified: () => false });
    expect(r).toEqual({ refusal: "verificacao-pendente", issues: ["sem-habilitacao"] });
  });
  it("não falsifica aprovação: proponente, técnico, sem capacidade, pulo de etapa", () => {
    expect(checkAssignmentEvent(ev(3, "validacao"), flow.slice(0, 2), caps, ctx).refusal).toBe("validador-e-proponente");
    expect(checkAssignmentEvent(ev(3, "validacao", { technical: true }), flow.slice(0, 2), caps, ctx).refusal).toBe("executor-tecnico");
    expect(checkAssignmentEvent(ev(1, "proposta", { draft }), [], {}, ctx).refusal).toBe("sem-capacidade");
    expect(checkAssignmentEvent(ev(2, "validacao", { authorPersonId: "PB" }), flow.slice(0, 1), caps, ctx).refusal).toBe("etapa-fora-de-ordem");
    expect(checkAssignmentEvent(ev(4, "formalizacao", { authorPersonId: "PB" }), flow.slice(0, 3), caps, ctx).refusal).toBe("sem-ato");
  });
  it("devolução volta à análise; encerramento exige motivo e é final", () => {
    expect(checkAssignmentEvent(ev(3, "devolucao"), flow.slice(0, 2), caps, ctx).refusal).toBe("sem-motivo");
    expect(checkAssignmentEvent(ev(6, "encerramento"), flow, caps, ctx).refusal).toBe("sem-motivo");
    const end = ev(6, "encerramento", { reason: "fim do ano" });
    expect(isEffective([...flow, end], "2026-03-10")).toBe(false);
    expect(checkAssignmentEvent(ev(7, "cancelamento", { reason: "x" }), [...flow, end], caps, ctx).refusal).toBe("encerrada");
  });
});
