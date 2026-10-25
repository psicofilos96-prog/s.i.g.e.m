import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CANONICAL_ENTITIES, FORBIDDEN_DUPLICATES, NET_CRITERIA, NET_SECTIONS, netAuditProblems, netSummary } from "./network-enrollment-audit";

const types = readFileSync("src/integrations/supabase/types.ts", "utf8").replace(/\r\n/g, "\n");
const tableKnown = (t: string) => new RegExp(`\\n\\s{6}${t}: \\{\\n\\s+Row:`).test(types);

describe("Rede/Matrículas/Vagas L01 — auditoria", () => {
  it("42 seções e 20 critérios numerados sem lacuna", () => {
    expect(NET_SECTIONS.map((x) => x.n)).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
    expect(NET_CRITERIA.map((x) => x.n)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it("evidências existem em disco e tabelas existem nos tipos gerados", () => {
    expect(netAuditProblems(existsSync, tableKnown)).toEqual([]);
  });
  it("entidades canônicas existem no banco", () => {
    for (const t of Object.values(CANONICAL_ENTITIES)) expect(tableKnown(t), t).toBe(true);
  });
  it("nenhuma migration cria tabela que duplique entidade acadêmica", () => {
    const sql = readdirSync("drizzle/migrations").filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8")).join("\n");
    for (const d of FORBIDDEN_DUPLICATES) expect(sql).not.toMatch(new RegExp(`create table (if not exists )?public\\.${d}\\b`, "i"));
  });
  it("resultado institucional e homologação permanecem bloqueados", () => {
    expect(NET_SECTIONS[41]?.status).toBe("bloqueado");
    expect(NET_CRITERIA[19]?.status).toBe("bloqueado");
    expect(Object.values(netSummary(NET_SECTIONS)).reduce((a, b) => a + b, 0)).toBe(42);
  });
});
