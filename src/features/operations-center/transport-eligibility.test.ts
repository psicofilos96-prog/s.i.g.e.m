import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authorizationState, canDecide, evaluateAnswers, reevaluationReasons, REEVALUATION_WRITES, type Decision } from "./transport-eligibility";

const SQL = readFileSync("drizzle/migrations/0423_ops16_transport_eligibility.sql", "utf8");
const C = [{ key: "residencia-zona-atendida", label: "Residência em zona atendida" }];
const base = { deciderPerson: "dir", requesterPerson: "sec", history: [] as Decision[], ruleApprovedAndCurrent: true, criteria: C, justification: "Conferido com documentos" };

describe("Centro de Operações L16 — elegibilidade e autorização de transporte", () => {
  it("critérios só da regra aprovada, todos respondidos com evidência", () => {
    expect(evaluateAnswers(C, {}).missing).toEqual(["residencia-zona-atendida"]);
    expect(canDecide({ ...base, kind: "autorizacao", ruleApprovedAndCurrent: false, answers: { "residencia-zona-atendida": { atende: true, evidencia: "comprovante" } } })).toEqual({ ok: false, reason: "rule-not-approved" });
    expect(canDecide({ ...base, kind: "autorizacao", answers: { "residencia-zona-atendida": { atende: false, evidencia: "comprovante" } } })).toEqual({ ok: false, reason: "criteria-not-met" });
    expect(canDecide({ ...base, kind: "indeferimento", answers: { "residencia-zona-atendida": { atende: false, evidencia: "comprovante" } } }).ok).toBe(true);
    expect(canDecide({ ...base, kind: "autorizacao", deciderPerson: "sec", answers: {} })).toEqual({ ok: false, reason: "self-decision" });
  });
  it("mudança acadêmica pede reavaliação sem negar direito", () => {
    const cur: Decision = { seq: 1, kind: "autorizacao", shiftValueId: "manha", validUntil: null };
    expect(reevaluationReasons(cur, { episodeActive: false, shiftValueId: "tarde", stopActive: true }, "2026-10-12")).toEqual(["matricula-ou-enturmacao-alterada", "turno-alterado"]);
    expect(authorizationState([cur])).toBe("autorizada");
    expect(REEVALUATION_WRITES).toEqual([]);
    expect(canDecide({ ...base, kind: "revogacao", history: [cur], justification: "curto" }).ok).toBe(false);
  });
  it("banco: matrícula oficial, ponto canônico, regra aprovada, sem DML direto nem revogação automática", () => {
    for (const r of ["opstq:no-active-enrollment", "opstq:invalid-stop", "opstd:self-decision", "opstd:rule-not-approved", "opstd:criteria-incomplete", "opstr:self-approval", "opstd:conflict"]) expect(SQL).toContain(r);
    expect(SQL).toMatch(/ops_transport_reevaluation_queue[\s\S]*SECURITY INVOKER/);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    expect(SQL).not.toMatch(/distanc|km\b/i);
  });
});
