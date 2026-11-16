import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0632_followup_municipal_school_scope.sql", "utf8");
describe("escopo configurado dos postos de acompanhamento", () => {
  it("autoriza apenas as classificações municipais urbanas e rurais na decisão inicial", () => {
    expect(sql).toContain("s.administrative_dependency='municipal'");
    expect(sql).toContain("s.location_kind IN ('urbana','rural')");
    expect(sql).toContain("DATE '2026-11-16'");
  });
  it("revalida cadastro vigente e falha fechado antes das capacidades dos postos", () => {
    expect(sql.indexOf("JOIN public.followup_school_scope_decisions")).toBeLessThan(sql.indexOf("public.followup_seat_effective_grants(_on)"));
    expect(sql).toContain("s.school_id=_school AND s.valid_from <= _on");
    expect(sql).toContain("ORDER BY s.version_number DESC LIMIT 1");
    expect(sql).toContain("THEN RETURN false; END IF;");
    expect(sql).toContain("public.effective_scope_capabilities(_on)");
  });
});