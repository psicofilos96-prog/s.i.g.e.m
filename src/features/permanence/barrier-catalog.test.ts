import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { activeCatalog, projectBarriers, validateBarrierEvent, judgmentFree, SUGGESTED_CATEGORIES, type BarrierType, type BarrierEvent } from "./barrier-catalog";

const t = (o: Partial<BarrierType>): BarrierType => ({ id: "T1", typeKey: "transporte", version: 2, label: "Transporte", sensitivity: "comum", requiresConfirmation: true, authorPerson: "a", approvedBy: "b", decisionRef: "Dec", ...o });
const e = (o: Partial<BarrierEvent>): BarrierEvent => ({ caseId: "C", barrierRef: "B", seq: 1, typeId: "T1", status: "relatada", sourceKind: "familia", sourceRef: null, justification: null, authorPerson: "a", ...o });

describe("L09 catálogo de barreiras", () => {
  it("só versão aprovada por outra pessoa vale; rascunho mais novo deixa pendente", () => {
    expect(activeCatalog([t({})]).active).toHaveLength(1);
    expect(activeCatalog([t({}), t({ id: "T2", version: 3, approvedBy: null, decisionRef: null })]).pending).toEqual(["transporte"]);
    expect(activeCatalog([t({ approvedBy: "a" })]).active).toHaveLength(0);
  });
  it("restrição reforçada: sem capacidade a barreira não aparece", () => {
    const vio = t({ id: "V", typeKey: "violencia", label: "Violência", sensitivity: "reforcada" });
    const evs = [e({}), e({ barrierRef: "X", typeId: "V" })];
    expect(projectBarriers(evs, [t({}), vio], new Set(["ler-barreiras-do-caso"])).map((b) => b.barrierRef)).toEqual(["B"]);
    expect(projectBarriers(evs, [t({}), vio], new Set(["ler-barreiras-do-caso", "ler-barreiras-reforcadas"]))).toHaveLength(2);
  });
  it("confirmação por outra pessoa com fonte; julgamento recusado", () => {
    const [v] = projectBarriers([e({})], [t({})], new Set(["ler-barreiras-do-caso"]));
    expect(v!.needsConfirmation).toBe(true);
    expect(validateBarrierEvent(v!, { status: "confirmada", sourceRef: "visita 3", justification: "confirmado em visita", authorPerson: "a" })).toMatch(/diferente/);
    expect(validateBarrierEvent(v!, { status: "confirmada", sourceRef: null, justification: "confirmado em visita", authorPerson: "c" })).toMatch(/fonte/);
    expect(validateBarrierEvent(v!, { status: "confirmada", sourceRef: "visita 3", justification: "família negligente", authorPerson: "c" })).toMatch(/julgamento/);
    expect(validateBarrierEvent(v!, { status: "confirmada", sourceRef: "visita 3", justification: "confirmado em visita", authorPerson: "c" })).toBeNull();
    expect(SUGGESTED_CATEGORIES.every((c) => judgmentFree(c.label))).toBe(true);
  });
  it("migration sem semente e com RLS por sensibilidade", () => {
    const sql = readFileSync("drizzle/migrations/0397_perm09_barrier_catalog.sql", "utf8");
    expect(sql).not.toMatch(/INSERT INTO public\.permanence_barrier_types\s*\(type_key[^)]*\)\s*VALUES\s*\('/);
    expect(sql).toMatch(/ler-barreiras-reforcadas/);
    expect(sql).toMatch(/permbar:self-confirmation/);
  });
});
