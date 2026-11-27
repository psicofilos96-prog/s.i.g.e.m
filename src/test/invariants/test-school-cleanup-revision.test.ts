import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0634_test_school_99999901_full_cleanup_revision.sql", "utf8");
const match = /expected constant jsonb := '([^']+)'::jsonb/.exec(sql);
if (!match?.[1]) throw new Error("Cleanup payload is missing");
const payload = JSON.parse(match[1]);

describe("full test-school cleanup revision", () => {
  it("targets only the exact fictitious school, including the school itself", () => {
    expect(payload.school_id).toBe("inep-99999901");
    expect(payload.expected.school).toBe(1);
    expect(sql).toContain("EXISTS(SELECT 1 FROM public.institutional_schools WHERE id='inep-99999901') THEN RAISE EXCEPTION 'technical:cleanup-postcondition-failed'");
  });
  it("proves the 80 enrollments without operation as 56 moved to 2027 plus 24 from the test secretariat", () => {
    expect(payload.expected.null_operation_enrollments).toBe(80);
    expect(payload.null_operation_enrollment_proof.moved_2027).toBe(56);
    expect(payload.null_operation_enrollment_proof.test_secretariat_manual).toBe(24);
    expect(sql).toContain("technical:cleanup-null-operation-provenance-mismatch");
  });
  it("keeps the 1797 and 219 real staff records byte-identical", () => {
    expect(payload.protected_staff.school_rows).toBe(1797);
    expect(payload.protected_staff.semed_rows).toBe(219);
    expect(sql).toContain("protected_after IS DISTINCT FROM protected_before");
  });
  it("keeps guards enabled and archives removed rows in the ledger", () => {
    expect(sql).not.toMatch(/DISABLE\s+TRIGGER|session_replication_role|DROP\s+(?:TRIGGER|CONSTRAINT)/i);
    expect(sql).toContain("technical:cleanup-unsupported-delete-guard");
    expect(sql).toContain("'archive',plan");
    expect(payload.audit_policy).toBe("full-row-archive-in-operation-ledger");
  });
  it("gives application roles no access to the cleanup or the delete allowances", () => {
    expect(sql).not.toMatch(/GRANT\s+(?:EXECUTE|SELECT|INSERT|ALL)[^;]*TO\s+(?:anon|authenticated|service_role)/i);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.technical_cleanup_delete_allowed(text,jsonb) FROM PUBLIC, anon, authenticated, service_role");
    expect(sql).toContain("REVOKE ALL ON public.technical_test_school_cleanup_delete_allowances FROM PUBLIC, anon, authenticated, service_role");
  });
  it("never deletes shared academic years or curricular components", () => {
    const allowlist = /allowed constant text\[\] := ARRAY\[([^;]+)\]/.exec(sql)?.[1] ?? "";
    expect(allowlist).not.toContain("institutional_academic_years");
    expect(allowlist).not.toContain("institutional_curricular_components");
    expect(sql).toContain("r.id=''mat-099999901''");
  });
});
