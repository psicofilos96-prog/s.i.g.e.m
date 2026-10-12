import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { linkPanel } from "./connectivity";

const link = { id: "L", schoolId: "s", provider: "P", contractedDown: 100, contractedUp: 20, validFrom: "2026-01-01", validUntil: null };
const m = (id: string, down: number, person = "a", available: boolean | null = true) => ({ id, linkId: "L", at: `2026-03-0${id}`, downMbps: down, upMbps: null, latencyMs: 10, available, personId: person });

describe("L13 conectividade", () => {
  it("só medições confirmadas por outra pessoa entram nos números", () => {
    const p = linkPanel(link, [m("1", 50), m("2", 90), m("3", 10)], [
      { measurementId: "1", verdict: "confirmada", personId: "b" },
      { measurementId: "2", verdict: "confirmada", personId: "a" }, // autoverificação: ignorada
      { measurementId: "3", verdict: "recusada", personId: "b" },
    ]);
    expect(p.verifiedCount).toBe(1);
    expect(p.medianDownMbps).toBe(50);
    expect(p.downVsContract).toBe(0.5);
  });
  it("sem medição verificada não há número (nunca zero)", () => {
    const p = linkPanel(link, [m("1", 50)], []);
    expect(p.medianDownMbps).toBeNull();
    expect(p.availabilityShare).toBeNull();
    expect(p.pendingVerification).toBe(1);
  });
  it("sem contrato juntado não compara com contratado", () => {
    const p = linkPanel({ ...link, contractedDown: null, contractedUp: null }, [m("1", 50)], [{ measurementId: "1", verdict: "confirmada", personId: "b" }]);
    expect(p.downVsContract).toBeNull();
    expect(p.contract).toBe("sem contrato juntado");
  });
  it("banco: autoverificação recusada, contrato só juntado, anon sem execução", () => {
    const f = readdirSync("drizzle/migrations").find((x) => x.startsWith("0487"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    expect(sql).toMatch(/_row\.person_id = _p THEN RAISE EXCEPTION 'autoverificacao'/);
    expect(sql).toMatch(/contrato-nao-juntado/);
    expect(sql).toMatch(/contract_ref IS NOT NULL OR \(contracted_down_mbps IS NULL/);
    expect(sql.match(/FROM PUBLIC, anon/g)).toHaveLength(3);
  });
});
