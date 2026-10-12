import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CANONICAL_OPS_SOURCES, FORBIDDEN_DUPLICATE_TABLES, MUNICIPAL_SYSTEMS, OPS_CRITERIA, OPS_SECTIONS, opsAuditProblems } from "./operations-audit";

const sql = ["drizzle/migrations", "supabase/migrations"].filter(existsSync)
  .flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`${d}/${f}`, "utf8"))).join("\n");
const created = (t: string) => new RegExp(`create table (if not exists )?(public\\.)?"?${t}"?\\s*\\(`, "i").test(sql);

describe("Centro de Operações L01 — auditoria", () => {
  it("60 seções + 20 critérios com evidência real e fontes que nascem em migration", () => {
    expect(opsAuditProblems(existsSync, created)).toEqual([]);
    expect(OPS_SECTIONS).toHaveLength(60);
    expect(OPS_CRITERIA).toHaveLength(20);
  });
  it("toda fonte canônica existe e nenhuma tabela duplicada foi criada", () => {
    for (const s of Object.values(CANONICAL_OPS_SOURCES)) { expect(existsSync(s.migration)).toBe(true); for (const t of s.tables) expect(created(t)).toBe(true); }
    for (const t of FORBIDDEN_DUPLICATE_TABLES) expect(created(t)).toBe(false);
  });
  it("sistema municipal nunca presumido; nada homologado", () => {
    expect(MUNICIPAL_SYSTEMS.found).toEqual([]);
    expect(JSON.stringify([OPS_SECTIONS, OPS_CRITERIA])).not.toMatch(/homologad[oa]"/);
  });
});
