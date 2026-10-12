import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { explainNumberingError, formatNumber, nextSeq, ruleIsEffective } from "./document-numbering";

const rule = { pattern: "OF-{seq}/{ano}-{unidade}", seqPadding: 3, status: "aprovada" as const, decisionRef: "dec-1" };

describe("L05 numeração institucional", () => {
  it("formata por tipo, unidade e ano", () => {
    expect(formatNumber(rule, "SEMED", 2026, 7)).toBe("OF-007/2026-SEMED");
  });
  it("cancelado nunca é reutilizado: próximo é sempre max+1", () => {
    expect(nextSeq([1, 2, 3])).toBe(4); // 2 cancelado continua contando
    expect(nextSeq([])).toBe(1);
  });
  it("só regra aprovada com decisão tem efeito", () => {
    expect(ruleIsEffective(rule)).toBe(true);
    expect(ruleIsEffective({ ...rule, status: "rascunho" })).toBe(false);
    expect(ruleIsEffective({ ...rule, decisionRef: null })).toBe(false);
  });
  it("traduz recusas do banco", () => {
    expect(explainNumberingError("ERROR: numbering:no-approved-rule")).toMatch(/regra/);
  });
  it("migration garante unicidade, lock, idempotência e append-only", () => {
    const f = readdirSync("drizzle/migrations").find((n) => n.includes("doc05_institutional_numbering"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    expect(sql).toMatch(/UNIQUE \(document_type_key, unit_id, year, seq\)/);
    expect(sql).toMatch(/pg_advisory_xact_lock/);
    expect(sql).toMatch(/idempotency_key text NOT NULL UNIQUE/);
    expect(sql).toMatch(/numbering:append-only/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
