// NTEST.4 — trava estática da superfície sem login (lacuna registrada em NSEC.4).
// Prova só o texto das migrations; o estado vivo do banco segue no harness/scan.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "drizzle/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const read = (f: string) => readFileSync(join(DIR, f), "utf8").replace(/--[^\n]*/g, "");
const ACCEPTED_ANON_FUNCTIONS = new Set([
  "verify_school_document",
  "public_portal_list",
  "public_portal_get",
  "verify_student_card",
  "verify_studio_document",
]);

describe("NTEST.4 superfície anon", () => {
  it("0249 revoga o privilégio padrão de tabela para anon", () => {
    const sql = read("0249_nsec4_revoke_anon_table_privileges.sql");
    expect(sql).toMatch(/ALTER DEFAULT PRIVILEGES[^;]*REVOKE ALL ON TABLES FROM anon/i);
  });

  it("nenhuma migration posterior a 0249 devolve privilégio de tabela a anon", () => {
    const after = files.filter((f) => f > "0249");
    const offenders = after.filter((f) => {
      const sql = read(f);
      return (
        /GRANT\s+(?!EXECUTE)[^;]*\bON\s+(TABLE\s+|ALL\s+TABLES\s+)?[^;]*\bTO\s+[^;]*\banon\b/i.test(sql) ||
        /ALTER DEFAULT PRIVILEGES[^;]*GRANT[^;]*\banon\b/i.test(sql)
      );
    });
    expect(offenders).toEqual([]);
  });

  it("EXECUTE para anon só nas 4 funções públicas aceitas", () => {
    const granted = new Set<string>();
    for (const f of files) {
      for (const m of read(f).matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+([^;]*?)\s+TO\s+([^;]*)/gi)) {
        if (!/\banon\b/i.test(m[2] ?? "")) continue;
        for (const fn of (m[1] ?? "").matchAll(/public\.(\w+)\s*\(/g)) granted.add(fn[1] ?? "");
      }
    }
    expect(granted.size).toBeGreaterThan(0);
    const extra = [...granted].filter((n) => !ACCEPTED_ANON_FUNCTIONS.has(n));
    expect(extra).toEqual([]);
  });
});
