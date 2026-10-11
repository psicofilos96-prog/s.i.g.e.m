import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { FACT_CATALOG } from "./fact-catalog";
import { FACT_GOVERNANCE, governanceProblems, CIECE_TRACE } from "./ciece-governance";

describe("governança do CIECE", () => {
  it("todo tipo de fato tem uma única entrada com dono e writer", () => {
    expect(FACT_GOVERNANCE.map((g) => g.factTypeId)).toEqual(FACT_CATALOG.map((d) => d.factTypeId));
    expect(new Set(FACT_GOVERNANCE.map((g) => g.factTypeId)).size).toBe(FACT_GOVERNANCE.length);
    expect(governanceProblems()).toEqual([]);
  });
  it("linhagem sempre passa pela fronteira analítica", () => {
    for (const g of FACT_GOVERNANCE) expect(g.lineage.at(-1)).toBe("analytic-boundary");
  });
  it("matriz cobre 11 seções e só aponta telas existentes", () => {
    expect(CIECE_TRACE).toHaveLength(11);
    for (const r of CIECE_TRACE) if (r.route) expect(existsSync(`src/routes${r.route}.tsx`), r.route).toBe(true);
    expect(CIECE_TRACE.find((r) => r.section.startsWith("4"))!.status).toBe("bloqueado");
  });
});
