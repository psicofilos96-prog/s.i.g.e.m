import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PERM_CLOSURE_CRITERIA, PERM_CLOSURE_SECTIONS, PERM_LOTS, PERM_SCENARIOS, permClosureProblems, permClosureSummary } from "./permanence-closure";

describe("Permanência L24 — fechamento", () => {
  it("toda evidência e cenário existem em disco", () => {
    expect(permClosureProblems(existsSync, (p) => readFileSync(p, "utf8"))).toEqual([]);
  });
  it("41 seções e 18 critérios, nenhum homologado", () => {
    expect(PERM_CLOSURE_SECTIONS).toHaveLength(41);
    expect(PERM_CLOSURE_CRITERIA).toHaveLength(18);
    const all = JSON.stringify([PERM_LOTS, PERM_CLOSURE_SECTIONS, PERM_CLOSURE_CRITERIA]);
    expect(all).not.toMatch(/"homologad[oa]"/);
  });
  it("normas ausentes continuam bloqueadas", () => {
    const s = (n: number) => PERM_CLOSURE_SECTIONS.find((r) => r.n === n)!.status;
    expect(s(8)).toBe("bloqueado");
    expect(s(24)).toBe("bloqueado");
    expect(s(28)).toBe("bloqueado");
    expect(PERM_LOTS.find((l) => l.lot === 21)!.status).toBe("bloqueado");
  });
  it("E2E autenticado declarado como pendente, nunca como provado", () => {
    expect(PERM_SCENARIOS.filter((s) => s.layer === "e2e-pendente").length).toBeGreaterThan(0);
    expect(permClosureSummary(PERM_CLOSURE_SECTIONS).bloqueado).toBeGreaterThan(0);
  });
});
