import { describe, expect, it } from "vitest";
import { activeSubstitute, checkLeave, checkSubstitution, currentStage, leaveForSchool, SUBSTITUTION_STAGES, type LeaveVersion, type StageCapabilities, type SubstitutionEvent } from "./leave-substitution";

const lv = (o: Partial<LeaveVersion>): LeaveVersion => ({ leaveId: "F1", version: 1, personId: "P1", linkLogicalId: "L1", adminType: "licenca-para-tratamento", validFrom: "2026-03-01", validUntil: "2026-03-31", operationalImpact: "total", documentRef: "proc-123", reason: null, freeText: null, authorUserId: "u1", technical: false, recordedAt: "2026-02-28", ...o });

describe("afastamentos", () => {
  it("registro válido exige documento, impacto e autor humano", () => {
    expect(checkLeave(lv({}), [])).toBeNull();
    expect(checkLeave(lv({ documentRef: null }), [])).toBe("sem-documento");
    expect(checkLeave(lv({ operationalImpact: null }), [])).toBe("impacto-nao-declarado");
    expect(checkLeave(lv({ technical: true }), [])).toBe("executor-tecnico");
  });
  it("informação clínica é recusada", () => {
    expect(checkLeave(lv({ freeText: "CID F32" }), [])).toBe("conteudo-clinico");
    expect(checkLeave(lv({ reason: "laudo de depressão" }), [])).toBe("conteudo-clinico");
  });
  it("histórico: nova versão com motivo e sequência", () => {
    expect(checkLeave(lv({ version: 2 }), [lv({})])).toBe("sem-motivo");
    expect(checkLeave(lv({ version: 3, reason: "prorrogação" }), [lv({})])).toBe("versao-inesperada");
  });
  it("escola recebe só tipo, período e impacto", () => {
    expect(Object.keys(leaveForSchool(lv({ freeText: "x" }))).sort()).toEqual(["adminType", "leaveId", "linkLogicalId", "operationalImpact", "validFrom", "validUntil"]);
  });
});

const caps: StageCapabilities = Object.fromEntries(SUBSTITUTION_STAGES.map((s) => [s, `sub-${s}`]));
const e = (seq: number, stage: SubstitutionEvent["stage"], o: Partial<SubstitutionEvent> = {}): SubstitutionEvent => ({
  processId: "S1", seq, stage, authorUserId: "u1", authorPersonId: "PA", technical: false,
  capabilityExercised: stage === "devolucao" || stage === "cancelamento" ? null : `sub-${stage}`, recordedAt: "2026-03-01", ...o,
});

describe("substituição", () => {
  const flow: SubstitutionEvent[] = [
    e(1, "necessidade", { leaveId: "F1" }), e(2, "protocolo"), e(3, "conferencia"),
    e(4, "proposta", { proposedPersonId: "P9" }), e(5, "validacao", { authorPersonId: "PB" }),
    e(6, "formalizacao", { authorPersonId: "PB", actRef: "port-55" }), e(7, "vigencia", { validFrom: "2026-03-02", validUntil: "2026-03-31" }),
  ];
  it("fluxo completo na ordem é aceito", () => {
    flow.forEach((ev, i) => expect(checkSubstitution(ev, flow.slice(0, i), caps)).toBeNull());
    expect(activeSubstitute(flow, "2026-03-10")).toBe("P9");
    expect(activeSubstitute(flow, "2026-04-02")).toBeNull();
  });
  it("etapa fora de ordem, sem capacidade configurada e técnico são recusados", () => {
    expect(checkSubstitution(e(1, "proposta", { proposedPersonId: "P9" }), [], caps)).toBe("etapa-fora-de-ordem");
    expect(checkSubstitution(e(1, "necessidade", { leaveId: "F1" }), [], {})).toBe("sem-capacidade");
    expect(checkSubstitution(e(1, "necessidade", { technical: true }), [], caps)).toBe("executor-tecnico");
  });
  it("validação pelo próprio proponente e formalização sem ato recusadas", () => {
    expect(checkSubstitution(e(5, "validacao"), flow.slice(0, 4), caps)).toBe("validador-e-proponente");
    expect(checkSubstitution(e(6, "formalizacao", { authorPersonId: "PB" }), flow.slice(0, 5), caps)).toBe("sem-ato");
  });
  it("devolução volta à conferência; encerramento exige motivo e é final", () => {
    const dev = e(5, "devolucao", { reason: "docente sem habilitação" });
    expect(checkSubstitution(dev, flow.slice(0, 4), caps)).toBeNull();
    expect(currentStage([...flow.slice(0, 4), dev])).toBe("conferencia");
    expect(checkSubstitution(e(8, "encerramento"), flow, caps)).toBe("sem-motivo");
    const end = e(8, "encerramento", { reason: "retorno do titular", validUntil: "2026-03-15" });
    expect(activeSubstitute([...flow, end], "2026-03-20")).toBeNull();
    expect(checkSubstitution(e(9, "cancelamento", { reason: "x" }), [...flow, end], caps)).toBe("processo-encerrado");
  });
});
