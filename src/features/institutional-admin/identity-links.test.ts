import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { canDecide, projectReviews, proposalProblem, type ReviewRow } from "./identity-links";

const base: ReviewRow = { id: "r1", target_user_id: "u-target", person_id: "p1", school_id: null, evidence_kind: "documento-conferido-presencialmente", evidence_note: "RG conferido no balcão", proposed_by: "u-a", proposed_at: "2026-10-10T00:00:00Z" };
const sql = readFileSync(`drizzle/migrations/${readdirSync("drizzle/migrations").find((f) => f.includes("identity_link_reviews"))}`, "utf8");

describe("LOTE 9 — associação conta↔pessoa", () => {
  it("estado deriva da decisão", () => {
    expect(projectReviews([base], [])[0]!.state).toBe("pendente");
    expect(projectReviews([base], [{ review_id: "r1", decision: "aprovado", reason: "conferido ok", decided_by: "u-b", decided_at: "x" }])[0]!.state).toBe("aprovado");
  });
  it("quem propôs não revisa; conta-alvo não revisa", () => {
    const item = projectReviews([base], [])[0]!;
    expect(canDecide(item, "u-a")).toBe(false);
    expect(canDecide(item, "u-target")).toBe(false);
    expect(canDecide(item, "u-b")).toBe(true);
  });
  it("sem evidência descrita ou auto-associação ⇒ recusa na tela", () => {
    expect(proposalProblem({ targetUserId: "u1", personId: "p", evidenceKind: "documento-conferido-presencialmente", evidenceNote: "nome igual" }, "u2")).not.toBeNull();
    expect(proposalProblem({ targetUserId: "u1", personId: "p", evidenceKind: "nome", evidenceNote: "x".repeat(20) }, "u2")).not.toBeNull();
    expect(proposalProblem({ targetUserId: "u1", personId: "p", evidenceKind: "documento-conferido-presencialmente", evidenceNote: "x".repeat(20) }, "u1")).not.toBeNull();
  });
  it("banco: nome não é evidência, segunda conta, append-only, sem anon, sem criar atuação", () => {
    expect(sql).not.toMatch(/'nome'/);
    expect(sql).toContain("person-without-identifier");
    expect(sql).toContain("reviewer-must-differ");
    expect(sql).toContain("identity-link:append-only");
    expect(sql).toMatch(/FROM PUBLIC, anon/);
    expect(sql).not.toMatch(/GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    expect(sql).not.toMatch(/INSERT INTO public\.institutional_engagements/);
  });
});
