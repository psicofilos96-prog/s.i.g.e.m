import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { projectAlert, validateEventDraft, alertEventKey, type AlertRow, type AlertEvent } from "./alert-center";

const a: AlertRow = { id: "A", idempotencyKey: "k", schoolId: "E1", studentId: "S1", ruleVersionId: "R", observedOn: "2026-10-01", observation: { taxa: 0.3 }, origin: "executor-tecnico" };
const ev = (seq: number, kind: AlertEvent["kind"], caseId: string | null = null): AlertEvent => ({ alertId: "A", seq, kind, caseId, justification: null, authorPerson: "p" });

describe("L05 central de alertas", () => {
  it("fluxo conferir → caso → encerrar; associar exige mesmo estudante", () => {
    let v = projectAlert(a, []);
    expect(v.actions).toEqual(["conferido"]);
    expect(validateEventDraft(v, "caso-aberto", { caseId: "C" })).not.toBeNull();
    v = projectAlert(a, [ev(1, "conferido")]);
    expect(validateEventDraft(v, "caso-associado", { caseId: "C", caseStudentId: "S2" })).toMatch(/mesmo estudante/);
    v = projectAlert(a, [ev(1, "conferido"), ev(2, "caso-associado", "C")]);
    expect([v.state, v.caseId, v.actions]).toEqual(["com-caso", "C", ["encerrado"]]);
    expect(validateEventDraft(v, "encerrado", { justification: "curta" })).toMatch(/justificativa/);
  });
  it("cadeia quebrada falha; chave por evento é estável", () => {
    expect(() => projectAlert(a, [ev(2, "conferido")])).toThrow();
    expect(alertEventKey("A", "conferido", 0)).toBe(alertEventKey("A", "conferido", 0));
  });
  it("migration garante idempotência, seq, um caso por alerta e caso canônico", () => {
    const sql = readFileSync("drizzle/migrations/0395_perm05_alert_center.sql", "utf8");
    expect(sql).toMatch(/idempotency_key text NOT NULL UNIQUE/);
    expect(sql).toMatch(/permanence_alert_one_case/);
    expect(sql).toMatch(/permalert:stale-base/);
    expect(sql).toMatch(/REFERENCES public\.aa_outreach_cases/);
    expect(sql).not.toMatch(/CREATE TABLE public\.\w*case/);
  });
});
