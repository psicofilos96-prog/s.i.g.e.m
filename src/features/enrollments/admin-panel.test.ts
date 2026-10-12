import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analysisProblems, pageInfo, rowStatus, type AdminApplication } from "./admin-panel";

const sql = readFileSync("drizzle/migrations/0463_enr11_admin_panel.sql", "utf8");

describe("L11 painel de inscrições", () => {
  it("situação nunca promete vaga", () => {
    expect(rowStatus({ protocol_number: null, docs_pending: 0, open_pendencies: 0 })).toBe("Aguardando protocolo");
    expect(rowStatus({ protocol_number: "PROT-2026-000001", docs_pending: 2, open_pendencies: 1 })).toMatch(/pendência/);
    expect(rowStatus({ protocol_number: "PROT-2026-000001", docs_pending: 0, open_pendencies: 0 })).toBe("Em análise");
  });
  it("paginação com total exato do servidor", () => {
    const row = { total_count: 120 } as AdminApplication;
    expect(pageInfo(Array(50).fill(row), 50)).toEqual({ total: 120, from: 51, to: 100, hasMore: true });
    expect(pageInfo([], 0).total).toBe(0);
  });
  it("anotação exige assunto e texto", () => {
    expect(analysisProblems({ subject: "x", note: "curto" })).toHaveLength(2);
  });
  it("banco: competência por rede ou escola escolhida; sem HMAC; limite 200; append-only com seq", () => {
    expect(sql).toContain("school_capability_schools('analisar-inscricoes-de-ingresso')");
    expect(sql).toContain("a.school_preferences &&");
    const reader = sql.slice(sql.indexOf("enr_admin_applications("), sql.indexOf("enr_admin_application_history"));
    expect(reader).not.toMatch(/cpf_hmac|check_hash/);
    expect(sql).toContain("least(greatest(coalesce(_limit,50),1),200)");
    expect(sql).toContain("enr_app_analyses_append_only");
    expect(sql).toContain("sequencia-desatualizada");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.enr_can_see_application[^;]*anon/);
  });
});
