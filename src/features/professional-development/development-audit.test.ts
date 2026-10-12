import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { DEV_CRITERIA, DEV_SECTIONS, EXTERNAL_PLATFORMS, FORBIDDEN_DUPLICATE_TABLES, devAuditProblems, devAuditSummary } from "./development-audit";

describe("SIGEM Desenvolvimento L01 — auditoria", () => {
  it("47 seções e 18 critérios com fontes que nascem em migration e evidência em disco", () => {
    expect(devAuditProblems(existsSync, (p) => readFileSync(p, "utf8"))).toEqual([]);
  });
  it("nenhum homologado; plataforma externa não presumida", () => {
    expect([...DEV_SECTIONS, ...DEV_CRITERIA].some((r) => (r.status as string) === "homologado")).toBe(false);
    expect(EXTERNAL_PLATFORMS.found).toEqual([]);
    expect(devAuditSummary(DEV_SECTIONS).bloqueado).toBeGreaterThan(0);
  });
  it("nenhuma migration cria tabela que duplique cadastro canônico", () => {
    const dirs = ["drizzle/migrations", "supabase/migrations"];
    const sql = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`${d}/${f}`, "utf8"))).join("\n");
    for (const t of FORBIDDEN_DUPLICATE_TABLES) expect(sql).not.toMatch(new RegExp(`CREATE TABLE (IF NOT EXISTS )?public\\.${t}\\s*\\(`));
  });
});
