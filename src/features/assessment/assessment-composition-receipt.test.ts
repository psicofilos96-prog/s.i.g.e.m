/**
 * 6D.3.3.3a — Recibo Canônico da Composição.
 * Prova apenas os riscos novos: o recibo registra fatos da execução e não
 * altera nenhum valor produzido pelo motor.
 */
import { describe, expect, it } from "vitest";
import { composePeriod } from "./assessment-composition";
import type {
  CompositionEntryInput,
  CompositionModel,
} from "./assessment-composition-types";

const model: CompositionModel = {
  id: "mc-recibo",
  label: "Modelo de teste do recibo",
  configurationId: "cfg-r",
  scaleSemantics: "quantitativa",
  categories: [
    {
      id: "cat-p",
      label: "Ponderada",
      instrumentTypeIds: ["tp-a"],
      weight: 1,
      aggregation: { kind: "media-ponderada" },
    },
    {
      id: "cat-t",
      label: "Com teto",
      instrumentTypeIds: ["tp-b"],
      weight: 1,
      maxScore: 50,
      aggregation: { kind: "soma" },
    },
  ],
  periodAggregation: { kind: "media-simples" },
  requiresAllPeriods: true,
  rounding: {
    id: "arr-recibo",
    mode: "meio-acima",
    decimals: 0,
    applyAt: ["periodo"],
    normativeStatus: "homologado",
  },
  administrativeEntries: { accepted: false, acceptedOrigins: [], normativeStatus: "pendente" },
  normativeStatus: "homologado",
  version: 3,
};

const e = (
  entryId: string,
  instrumentTypeId: string,
  value: number | null,
  weight?: number,
): CompositionEntryInput => ({
  entryId,
  instrumentId: `ins-${entryId}`,
  instrumentTypeId,
  periodId: "p1",
  configurationId: "cfg-r",
  value:
    value === null
      ? { kind: "nao-registrado", reason: "ausente" }
      : { kind: "numerica", value },
  status: "registrado",
  ...(weight === undefined ? {} : { weight }),
});

const run = (entries: CompositionEntryInput[]) =>
  composePeriod({ model, period: { id: "p1" }, entries, official: false });

describe("recibo canônico da composição", () => {
  const base = [e("a1", "tp-a", 80, 2), e("a2", "tp-a", 90), e("b1", "tp-b", 30), e("b2", "tp-b", 35)];

  it("A/B: peso explícito e peso implícito 1 aparecem como effectiveWeight", () => {
    const cat = run(base).categories.find((c) => c.categoryId === "cat-p")!;
    expect(cat.usedEntries).toEqual([
      { entryId: "a1", effectiveValue: 80, effectiveWeight: 2 },
      { entryId: "a2", effectiveValue: 90, effectiveWeight: 1 },
    ]);
  });

  it("C/D: fora de todas as categorias é unmatched; rejeitada em categoria é missing", () => {
    const r = run([...base, e("x1", "tp-fora", 70), e("a3", "tp-a", null)]);
    expect(r.unmatchedEntryIds).toEqual(["x1"]);
    expect(r.unmatchedEntryIds).not.toContain("a3");
    expect(r.missing.some((m) => "entryId" in m && m.entryId === "a3")).toBe(true);
    expect(r.missing.some((m) => "entryId" in m && m.entryId === "x1")).toBe(false);
  });

  it("E: teto configurado e não atingido é registrado como não aplicado", () => {
    const cat = run([e("a1", "tp-a", 80), e("b1", "tp-b", 20), e("b2", "tp-b", 10)]).categories[1]!;
    expect(cat.cap).toEqual({ maxScore: 50, applied: false, valueBeforeCap: 30, valueAfterCap: 30 });
    expect(run(base).categories[0]!.cap).toBeUndefined();
  });

  it("F: teto aplicado preserva valor antes e depois", () => {
    const cat = run(base).categories[1]!;
    expect(cat.cap).toEqual({ maxScore: 50, applied: true, valueBeforeCap: 65, valueAfterCap: 50 });
  });

  it("G: estágios preservam a identidade canônica da política de arredondamento", () => {
    const r = run(base);
    expect(r.stage).toMatchObject({ rounded: true, roundingPolicyId: "arr-recibo" });
    expect(r.categories[0]!.stage).toMatchObject({ rounded: false, roundingPolicyId: "arr-recibo" });
  });

  it("H: valores matemáticos permanecem idênticos aos produzidos antes do recibo", () => {
    const r = run(base);
    // (80*2 + 90*1)/3 = 83,333…; teto 65→50; período (83,333…+50)/2 = 66,666… → 67
    expect(r.categories[0]!.stage).toMatchObject({ raw: 83.3333333333, value: 83.3333333333 });
    expect(r.categories[1]!.stage).toMatchObject({ raw: 50, value: 50 });
    expect(r.stage).toMatchObject({ point: "periodo", raw: 66.6666666667, value: 67 });
    expect(r.categories.map((c) => c.usedEntryIds)).toEqual([["a1", "a2"], ["b1", "b2"]]);
    expect(r.complete).toBe(true);
  });
});
