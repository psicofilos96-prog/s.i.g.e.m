import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { applicableDeadlineRule, archivalPhase, digitizationState, dueDate, grantAllows, signatureLabel, versionStage, type DeadlineRule } from "./document-lifecycle";

const sql = readFileSync(`drizzle/migrations/${readdirSync("drizzle/migrations").find((n) => n.includes("doc11_18_review_signature_archive"))}`, "utf8");

describe("L11–L19 ciclo documental", () => {
  it("L11 revisão separada de assinatura; autorrevisão ignorada", () => {
    expect(versionStage("a", [{ verdict: "aprovado", reviewerPerson: "a" }], [])).toBe("em-revisao");
    expect(versionStage("a", [{ verdict: "aprovado", reviewerPerson: "b" }], [])).toBe("aprovado");
    expect(sql).toMatch(/review:self-review/);
    expect(sql).toMatch(/sign:not-approved/);
  });
  it("L12 assinatura simples por padrão; qualificada só com evidência", () => {
    expect(signatureLabel({ signerPerson: "x", signatureLevel: "qualificada", qualifiedEvidenceRef: null })).toMatch(/simples/);
    expect(sql).toMatch(/CHECK \(signature_level = 'simples' OR qualified_evidence_ref IS NOT NULL\)/);
  });
  it("L13 verificação pública: código opaco e resposta igual para inexistente", () => {
    expect(sql).toMatch(/gen_random_bytes\(12\)/);
    expect(sql).toMatch(/'indisponivel'/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public.verify_admin_act_signature\(text\) TO anon/);
  });
  it("L14 prazo só com regra aprovada; úteis sem calendário ⇒ null", () => {
    const r: DeadlineRule = { ruleKey: "k", version: 1, classificationCode: "c", days: 2, dayKind: "uteis", status: "aprovada", decisionRef: "d" };
    expect(applicableDeadlineRule([r, { ...r, version: 2, status: "revogada" }], "c")).toBeNull();
    expect(dueDate("2026-10-01", r, null)).toBeNull();
    expect(dueDate("2026-10-01", r, ["2026-10-02", "2026-10-05"])).toBe("2026-10-05");
    expect(dueDate("2026-10-01", { ...r, dayKind: "corridos" }, null)).toBe("2026-10-03");
  });
  it("L17 nunca descarte automático; quem propõe não autoriza", () => {
    const p = archivalPhase([{ eventType: "eliminacao_proposta", authorPerson: "a" }, { eventType: "eliminacao_autorizada", authorPerson: "a" }]);
    expect(p.eliminable).toBe(false);
    expect(p.automaticDisposal).toBe(false);
    expect(sql).toMatch(/archive:same-person/);
  });
  it("L18 conferência por outra pessoa", () => {
    expect(digitizationState({ digitizedBy: "a" }, { result: "conforme", conferredBy: "a" })).toBe("conferencia-invalida");
    expect(sql).toMatch(/digitize:same-person/);
  });
  it("L19 concessão vigente, não revogada, escopo sensível explícito", () => {
    expect(grantAllows({ scope: "leitura", validUntil: "2026-12-31", revoked: false }, "leitura_anexos_sensiveis", "2026-10-12")).toBe(false);
    expect(grantAllows({ scope: "leitura_anexos_sensiveis", validUntil: "2026-01-01", revoked: false }, "leitura", "2026-10-12")).toBe(false);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
