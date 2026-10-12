import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CANONICAL_DOCUMENT_STRUCTURES, DOC_CRITERIA, DOC_SECTIONS, EXTERNAL_OFFICIAL_SYSTEMS, FORBIDDEN_DUPLICATE_TABLES, docAuditProblems, docAuditSummary } from "./documents-audit";

const sql = readdirSync("drizzle/migrations").filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8")).join("\n").toLowerCase();
const created = (t: string) => new RegExp(`create table (if not exists )?(public\\.)?"?${t}"?[\\s(]`).test(sql);

describe("SIGEM Documentos L01 — auditoria", () => {
  it("41 seções e 20 critérios numerados sem lacuna", () => {
    expect(DOC_SECTIONS.map((r) => r.n)).toEqual(Array.from({ length: 41 }, (_, i) => i + 1));
    expect(DOC_CRITERIA.map((r) => r.n)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it("toda evidência existe em disco e toda tabela citada nasce em migration", () => {
    expect(docAuditProblems((p) => existsSync(p), created)).toEqual([]);
  });
  it("estruturas canônicas existem e nenhuma tabela concorrente de GED/protocolo foi criada", () => {
    for (const t of Object.values(CANONICAL_DOCUMENT_STRUCTURES).flat()) expect(created(t), t).toBe(true);
    for (const t of FORBIDDEN_DUPLICATE_TABLES) expect(created(t), t).toBe(false);
  });
  it("sem sistema oficial externo presumido e sem homologação fictícia", () => {
    expect(EXTERNAL_OFFICIAL_SYSTEMS.found).toEqual([]);
    expect(DOC_SECTIONS[40]?.status).toBe("bloqueado");
    expect(DOC_CRITERIA[19]?.status).toBe("bloqueado");
    expect(JSON.stringify([...DOC_SECTIONS, ...DOC_CRITERIA])).not.toMatch(/homologad[oa]"/);
  });
  it("resumo soma o total", () => {
    expect(Object.values(docAuditSummary(DOC_SECTIONS)).reduce((a, b) => a + b, 0)).toBe(41);
  });
});
