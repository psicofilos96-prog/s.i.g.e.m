import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { CANONICAL_PERMANENCE_SOURCES, FORBIDDEN_DUPLICATE_TABLES, NATIONAL_BAE, PERM_CRITERIA, PERM_SECTIONS, permAuditProblems, permAuditSummary } from "./permanence-audit";

const allSql = ["supabase/migrations", "drizzle/migrations"].flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`${d}/${f}`, "utf8"))).join("\n");
const tableKnown = (t: string) => new RegExp(`CREATE TABLE (IF NOT EXISTS )?(public\\.)?${t}\\b`).test(allSql) || new RegExp(`FUNCTION (public\\.)?${t}\\b`).test(allSql);

describe("Permanência L01 auditoria", () => {
  it("41 seções e 18 critérios com evidência em disco e fontes que existem no banco", () => {
    expect(permAuditProblems(existsSync, tableKnown)).toEqual([]);
    expect(PERM_SECTIONS).toHaveLength(41);
    expect(PERM_CRITERIA).toHaveLength(18);
  });
  it("fontes canônicas nascem em migration", () => {
    for (const s of Object.values(CANONICAL_PERMANENCE_SOURCES)) {
      expect(existsSync(s.migration), s.migration).toBe(true);
      for (const t of s.tables) expect(tableKnown(t), t).toBe(true);
    }
  });
  it("nenhuma migration cria fonte paralela de frequência/caso", () => {
    for (const t of FORBIDDEN_DUPLICATE_TABLES) expect(new RegExp(`CREATE TABLE (IF NOT EXISTS )?(public\\.)?${t}\\s*\\(`).test(allSql), t).toBe(false);
  });
  it("BAE nacional não integrada e nunca presumida; sem status homologado", () => {
    expect(NATIONAL_BAE.integrated).toBe(false);
    expect(NATIONAL_BAE.found).toEqual([]);
    expect([...PERM_SECTIONS, ...PERM_CRITERIA].some((r) => (r.status as string) === "homologado")).toBe(false);
    expect(PERM_SECTIONS.find((r) => r.n === 28)?.status).toBe("bloqueado");
  });
  it("resumo", () => {
    const s = permAuditSummary(PERM_SECTIONS);
    expect(s.existente + s.parcial + s.lacuna + s.bloqueado).toBe(41);
  });
});
