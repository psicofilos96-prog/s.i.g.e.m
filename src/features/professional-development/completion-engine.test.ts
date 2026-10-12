import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeCompletion, confirmationProblems, criteriaProblems, type CompletionCriteria } from "./completion-engine";

const c: CompletionCriteria = { minAttendancePct: 75, minActivitiesDelivered: 1, rubricVersionId: "r1", acceptedOutcomes: ["atingiu"], approved: true };
const units = (s: ("presente" | "ausente" | "ausencia-justificada" | null)[]) => s.map((status, k) => ({ unit: `u${k}`, status }));
const good = { units: units(["presente", "presente", "presente", "ausente"]), activitiesDelivered: 1, learningResult: { outcome: "atingiu" as const, reviewPending: false } };

describe("L15 motor de conclusão", () => {
  it("critério não aprovado recusa", () => expect(() => computeCompletion({ ...c, approved: false }, good)).toThrow(/criteria-not-approved/));
  it("75% com tudo atendido = apto", () => expect(computeCompletion(c, good)).toMatchObject({ verdict: "apto", attendancePct: 75 }));
  it("não lançado nunca vira falta: indeterminado", () =>
    expect(computeCompletion(c, { ...good, units: units(["presente", null]) })).toMatchObject({ verdict: "indeterminado", attendancePct: null }));
  it("ausência justificada fora do denominador", () =>
    expect(computeCompletion(c, { ...good, units: units(["presente", "ausencia-justificada"]) }).attendancePct).toBe(100));
  it("frequência baixa, atividades faltando e desfecho não aceito = não apto", () => {
    const r = computeCompletion(c, { units: units(["presente", "ausente"]), activitiesDelivered: 0, learningResult: { outcome: "nao-atingiu", reviewPending: false } });
    expect(r.verdict).toBe("nao-apto");
    expect(r.reasons).toHaveLength(3);
  });
  it("revisão pendente ou sem resultado = indeterminado", () => {
    expect(computeCompletion(c, { ...good, learningResult: { outcome: "atingiu", reviewPending: true } }).verdict).toBe("indeterminado");
    expect(computeCompletion(c, { ...good, learningResult: null }).verdict).toBe("indeterminado");
  });
  it("critério inválido", () => expect(criteriaProblems({ ...c, rubricVersionId: null }).length).toBe(1));
  it("confirmação: competente ≠ participante, hash atual, decisão compatível", () => {
    const a = { verdict: "apto" as const, participant: "p", storedSha: "x" };
    expect(confirmationProblems(a, { decision: "conclusao", confirmer: "g", recomputedSha: "x" })).toEqual([]);
    expect(confirmationProblems(a, { decision: "conclusao", confirmer: "p", recomputedSha: "y" })).toHaveLength(2);
    expect(confirmationProblems(a, { decision: "nao-conclusao", confirmer: "g", recomputedSha: "x" })).toHaveLength(1);
  });
  it("migration 0444: writer genérico não conclui, hash e confirmação competente", () => {
    const sql = readFileSync("drizzle/migrations/0444_dev15_completion_engine.sql", "utf8");
    expect(sql).toMatch(/dev:use-completion-engine/);
    expect(sql).toMatch(/dev:assessment-stale/);
    expect(sql).toMatch(/dev:self-confirmation/);
    expect(sql).toMatch(/dev:self-approval/);
    expect(sql).toMatch(/confirmar-conclusao-de-formacao/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public.dev_completion_compute\(uuid\) FROM PUBLIC, anon, authenticated/);
  });
});
