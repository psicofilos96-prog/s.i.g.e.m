import { describe, expect, it } from "vitest";
import { allowedNext, canWriteSection, eventProblem, isOverdue, timeline, type CaseEvent } from "./nei-cases";

describe("NEI casos", () => {
  it("encerramento é terminal", () => expect(allowedNext("encerramento")).toEqual([]));
  it("solicitação não pula para execução", () => expect(eventProblem("solicitacao", "execucao", "andamento")).not.toBeNull());
  it("reavaliação pode voltar à execução", () => expect(eventProblem("reavaliacao", "execucao", "volta")).toBeNull());
  it("encerramento exige justificativa de 10 caracteres", () => {
    expect(eventProblem("monitoramento", "encerramento", "fim")).not.toBeNull();
    expect(eventProblem("monitoramento", "encerramento", "objetivos atingidos")).toBeNull();
  });
  it("AEE só grava a seção AEE", () => { expect(canWriteSection("aee", "planos")).toBe(false); expect(canWriteSection("aee", "aee")).toBe(true); });
  it("sem prazo declarado nunca está vencido", () => {
    const e: CaseEvent = { seq: 1, stage: "triagem", note: "x", priority: null, due_date: null, assigned: false, assigned_to_me: false, recorded_at: "", mine: false };
    expect(isOverdue(e, "2026-10-11")).toBe(false);
    expect(isOverdue({ ...e, due_date: "2026-10-01" }, "2026-10-11")).toBe(true);
  });
  it("linha do tempo mais recente primeiro", () => {
    const t = timeline([{ id: "a", section: "aee", content: "c", supersedes_id: null, correction_reason: null, recorded_at: "2026-01-01", mine: true, current: true }],
      [{ id: "c", request_summary: "s", requested_by_label: null, opened_at: "", events: [{ seq: 1, stage: "solicitacao", note: "n", priority: null, due_date: null, assigned: false, assigned_to_me: false, recorded_at: "2026-02-01", mine: true }] }]);
    expect(t[0]!.kind).toBe("caso");
  });
});
