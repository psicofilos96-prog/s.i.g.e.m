import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { NAE_CAPABILITIES, NAE_FLOW, NAE_BLOCKERS, naeQuantity, plannedVsExecuted } from "./nae-foundation";

const dir = "drizzle/migrations";
const sql = readFileSync(`${dir}/${readdirSync(dir).find((f) => f.startsWith("0181_"))}`, "utf8");

describe("NAE.0 fundação", () => {
  it("capabilities únicas e todas reconhecidas pelos helpers date-aware", () => {
    const ids = NAE_CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(sql).toContain(`'${id}'`);
  });
  it("writers datados autorizam pela data do fato, nunca por CURRENT_DATE", () => {
    expect(sql).toContain("effective_scope_capabilities(_on)");
    expect(sql).not.toMatch(/effective_scope_capabilities\(CURRENT_DATE\)/);
    expect(sql).not.toMatch(/public\.meal_grant\('/);
    expect(sql).not.toMatch(/public\.meal_network_grant\('/);
    expect((sql.match(/af_natural_person\(\)/g) ?? []).length).toBe(7);
  });
  it("helpers sem EXECUTE para app roles; sem DML direto nem seed", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.meal_grant_on\(text, text, date\) FROM PUBLIC, anon, authenticated, service_role/);
    expect(sql).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE)/i);
    expect(sql).not.toMatch(/INSERT INTO public\.(attribute_value|capability_policy)/);
  });
  it("estágios distintos, unknown ≠ zero, planejado ≠ executado", () => {
    for (const s of ["pedido", "autorizacao", "recebimento", "estoque"]) expect(NAE_FLOW).toContain(s);
    expect(naeQuantity(null)).toBe("UNKNOWN");
    expect(naeQuantity(0)).toBe(0);
    expect(plannedVsExecuted(10, null).difference).toBe("UNKNOWN");
    expect(plannedVsExecuted(10, 8).difference).toBe(-2);
    expect(NAE_BLOCKERS.length).toBeGreaterThan(5);
  });
});
