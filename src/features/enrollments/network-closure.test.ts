import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLOSURE_BASE_SHA, NET_CLOSURE_CRITERIA, NET_CLOSURE_SECTIONS, netClosureProblems, netClosureSummary } from "./network-closure";

describe("Rede L24 — matriz de fechamento", () => {
  it("42 seções e 20 critérios numerados sem lacuna", () => {
    expect(NET_CLOSURE_SECTIONS.map((r) => r.n)).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
    expect(NET_CLOSURE_CRITERIA.map((r) => r.n)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(CLOSURE_BASE_SHA).toMatch(/^[a-f0-9]{40}$/);
  });
  it("toda evidência citada existe em disco", () => {
    expect(netClosureProblems((p) => existsSync(p))).toEqual([]);
  });
  it("nenhuma homologação fictícia; resultado institucional bloqueado", () => {
    expect(NET_CLOSURE_SECTIONS[41]?.status).toBe("bloqueado");
    expect(NET_CLOSURE_CRITERIA[19]?.status).toBe("bloqueado");
    expect(JSON.stringify([...NET_CLOSURE_SECTIONS, ...NET_CLOSURE_CRITERIA])).not.toMatch(/"status":"homologad/);
  });
  it("teste SQL de RLS cobre as entidades canônicas e a revogação está na migration", () => {
    const sql = readFileSync("supabase/tests/net24_enrollment_rls.sql", "utf8");
    for (const t of ["school_enrollments", "class_enrollment_episodes", "student_movement_events", "institutional_students"]) expect(sql).toContain(t);
    expect(readFileSync("drizzle/migrations/0384_net24_revoke_students_direct_dml.sql", "utf8")).toMatch(/REVOKE INSERT, UPDATE, DELETE/);
  });
  it("resumo soma o total", () => {
    expect(Object.values(netClosureSummary(NET_CLOSURE_SECTIONS)).reduce((a, b) => a + b, 0)).toBe(42);
  });
});
