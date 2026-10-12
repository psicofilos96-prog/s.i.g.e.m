import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { FORBIDDEN_TECH_DUPLICATES, SPEC_STATUS, TECH_CANONICAL_SOURCES, TECH_GAPS, techAuditProblems } from "./technology-audit";

const files = [
  ...readdirSync("drizzle/migrations").filter((f) => f.endsWith(".sql")).map((f) => `drizzle/migrations/${f}`),
  ...readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).map((f) => `supabase/migrations/${f}`),
];
const sql = files.map((f) => readFileSync(f, "utf8")).join("\n");
const tableIn = (t: string) => new RegExp(`CREATE TABLE (IF NOT EXISTS )?(public\\.)?${t}\\s*\\(`).test(sql);

describe("Tecnologia L01 — auditoria", () => {
  it("toda fonte canônica existe e nasce em migration", () => {
    expect(techAuditProblems(existsSync, tableIn)).toEqual([]);
  });
  it("nenhuma tabela duplicada de escola/pessoa/bem/espaço/chamado/documento/curso", () => {
    for (const t of FORBIDDEN_TECH_DUPLICATES) expect(tableIn(t)).toBe(false);
  });
  it("lacunas estendem fontes canônicas e declaram dependência real", () => {
    expect(TECH_GAPS.length).toBeGreaterThan(5);
    for (const g of TECH_GAPS) expect(Object.keys(TECH_CANONICAL_SOURCES)).toContain(g.extends);
  });
  it("não inventa os títulos das 49 seções/18 critérios sem o documento", () => {
    expect(SPEC_STATUS).toMatchObject({ sectionsExpected: 49, criteriaExpected: 18, documentInProject: false });
  });
});
