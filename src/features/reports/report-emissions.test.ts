import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isReportCode, reissueComparison, reportVerifyUrl, verificationBlock } from "./report-emissions";

const sql = readFileSync("drizzle/migrations/0288_report_emissions_ledger.sql", "utf8");
describe("emissões de relatório", () => {
  it("código opaco de 20 hex; URL só com código", () => {
    expect(isReportCode("ABCDEF0123456789ABCD")).toBe(true);
    expect(isReportCode("123")).toBe(false);
    expect(reportVerifyUrl("abcdef0123456789abcd", "https://x.app")).toBe("https://x.app/verificar/relatorio/ABCDEF0123456789ABCD");
    expect(() => reportVerifyUrl("x", "https://x.app")).toThrow();
  });
  it("bloco de verificação traz QR e nenhum dado do relatório", () => {
    const b = verificationBlock("ABCDEF0123456789ABCD", "https://x.app");
    expect(b).toContain("data:image/gif;base64"); expect(b).toContain("ABCDEF0123456789ABCD");
  });
  it("reemissão compara SHA-256", () => {
    expect(reissueComparison(null, "a")).toBe("primeira");
    expect(reissueComparison("a", "a")).toBe("identico");
    expect(reissueComparison("a", "b")).toBe("divergente");
  });
  it("banco: append-only, leitura só do próprio emissor, anon só verifica", () => {
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.report_emissions/);
    expect(sql).toMatch(/USING \(actor_id = auth\.uid\(\)\)/);
    expect(sql).not.toMatch(/GRANT [^;]*ON public\.report_emissions TO [^;]*anon/);
    expect(sql).toMatch(/record_report_emission[^;]*FROM PUBLIC, anon/);
    expect(sql).toMatch(/REISSUE_NOT_ALLOWED/);
    // verificação pública não devolve params nem actor
    const verify = sql.slice(sql.indexOf("verify_report_emission(_code text)"));
    expect(verify).not.toMatch(/'params'|'actor_id'/);
  });
});

describe("gerador sem login", () => {
  it("não lê fonte nem exporta relatório de trabalho anonimamente", () => {
    const page = readFileSync("src/features/reports/report-builder-page.tsx", "utf8");
    expect(page).not.toMatch(/relatório de trabalho, sem registro/);
    expect(page).toMatch(/if \(!user\) return/);
    expect((page.match(/if \(!cloud\) \{ setErr\(ANON_BLOCK\); return; \}/g) ?? []).length).toBe(2);
  });
});
