import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0633_test_school_99999901_fail_closed_cleanup.sql", "utf8");
const match = /expected constant jsonb := '([^']+)'::jsonb/.exec(sql);
if (!match?.[1]) throw new Error("Cleanup payload is missing");
const payload = JSON.parse(match[1]);

describe("restricted test-school cleanup contract", () => {
  it("allows only the exact test school and both recorded source operations", () => {
    expect(payload.school_id).toBe("inep-99999901");
    expect(payload.source_operations).toEqual([
      "5e6fdb25-2c18-4bde-b20e-3dd6dd8c0c20",
      "7a2f0000-0000-4000-8000-000000002027",
    ]);
  });
  it("requires 192 enrollments, including exactly 80 without a technical operation", () => {
    expect(payload.expected.enrollments).toBe(192);
    expect(payload.expected.null_operation_enrollments).toBe(80);
    expect(sql).toContain("technical:cleanup-mixed-student-person-scope");
  });
  it("requires the 16 exact-source staff records and preserves 1797 and 219 real records", () => {
    expect(payload.expected.staff_source).toBe(16);
    expect(payload.protected_staff.school_rows).toBe(1797);
    expect(payload.protected_staff.semed_rows).toBe(219);
    expect(sql).toContain("source_file IS DISTINCT FROM 'Escola de teste (dados fictícios)'");
  });
  it("does not grant execution to application roles", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.technical_cleanup_test_school_99999901\(text,jsonb\) FROM PUBLIC,anon,authenticated,service_role/);
    expect(sql).not.toMatch(/GRANT\s+EXECUTE/i);
    expect(sql).toContain("technical:cleanup-owner-channel-required");
  });
  it("retains audit and never disables existing triggers", () => {
    expect(payload.preserve_audit).toBe(true);
    expect(sql).toContain("technical:cleanup-retained-audit-reference");
    expect(sql).not.toMatch(/DISABLE\s+TRIGGER|session_replication_role|DROP\s+(?:TRIGGER|CONSTRAINT)/i);
  });
  it("keeps shared catalogs out of the deletion allowlist", () => {
    const allowlist = /allowed constant text\[\] := ARRAY\[([^;]+)\]/.exec(sql)?.[1] ?? "";
    expect(allowlist).not.toContain("institutional_academic_years");
    expect(allowlist).not.toContain("institutional_curricular_matrices");
    expect(allowlist).not.toContain("institutional_curricular_components");
    expect(allowlist.length).toBeGreaterThan(100);
  });
  it("serializes and returns the recorded operation before new writes", () => {
    const lock = sql.indexOf("pg_advisory_xact_lock");
    const existing = sql.indexOf("RETURN existing.id;");
    const write = sql.indexOf("INSERT INTO public.technical_execution_operations");
    expect(lock).toBeGreaterThan(0);
    expect(existing).toBeGreaterThan(lock);
    expect(write).toBeGreaterThan(existing);
    expect(sql).toContain("technical:cleanup-retry-differs");
  });
  it("deletes the school last with truthful technical execution identity", () => {
    expect(sql).toContain("predicate='institutional_schools' AND pg_catalog.cardinality(remaining)>1");
    expect(sql).toContain("'automacao-tecnica','executor técnico restrito de limpeza SIGEM (Lovable)'");
    expect(sql).toContain("INSERT INTO public.technical_execution_targets");
  });
});