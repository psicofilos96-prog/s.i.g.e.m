import { describe, it, expect } from "vitest";
import { itemProblems, netQty, scale, cookedYield, trustedNutrients, sheetProblems, canApprove, type Sheet } from "./technical-sheet";
import type { MasterRow } from "./planning-model";

const row = (id: string, payload: Record<string, unknown> = {}, status: MasterRow["status"] = "homologada"): MasterRow =>
  ({ logical_id: id, version: 1, status, school_id: null, valid_from: "2026-01-01", valid_to: null, payload, author_person_id: "a", recorded_at: "", functional_validation: null });

const sheet: Sheet = { name: "Arroz", ingredients: [{ itemId: "arroz", grossQty: 1100, unit: "g", correctionFactor: 1.1 }], yieldPortions: 20, portionGrams: 120, cookingFactor: 2.5, method: "cozinhar", conservation: "servir quente", nutrients: [{ key: "kcal", perPortion: 150, sourceId: "taco" }, { key: "ferro", perPortion: 1, sourceId: null }] };

describe("catálogo e ficha técnica", () => {
  it("embalagem em outra unidade sem fator homologado é recusada; alergênico null ≠ nenhum", () => {
    const p = itemProblems({ id: "oleo", name: "Óleo", baseUnit: "ml", storage: "seco", packages: [{ label: "lata", qty: 900, unit: "g" }], allergens: null }, []);
    expect(p.some((x) => x.includes("densidade nunca é presumida"))).toBe(true);
    expect(p.some((x) => x.includes("alergênicos"))).toBe(true);
    expect(itemProblems({ id: "oleo", name: "Óleo", baseUnit: "ml", storage: "seco", packages: [{ label: "lata", qty: 900, unit: "g" }], allergens: [] }, [row("f", { de_unidade_ref: "g", para_unidade_ref: "ml", fator: 1.09 })])).toEqual([]);
  });
  it("cálculos: líquido, escala e rendimento cozido", () => {
    expect(netQty(sheet.ingredients[0]!)).toBe(1000);
    expect(netQty({ ...sheet.ingredients[0]!, correctionFactor: null })).toBeNull();
    const s = scale(sheet, 50);
    expect(s.ok && s.lines[0]!.gross).toBe(2750);
    expect(scale({ ...sheet, yieldPortions: null }, 10).ok).toBe(false);
    expect(cookedYield(sheet)).toBe(2500);
  });
  it("nutriente sem fonte homologada é descartado", () => {
    const n = trustedNutrients(sheet, [{ id: "taco", label: "TACO 4ª ed.", homologated: true }]);
    expect(n.shown.map((x) => x.key)).toEqual(["kcal"]);
    expect(n.rejected).toEqual(["ferro"]);
  });
  it("ingrediente não homologado bloqueia; aprovação exige registro e pessoa distinta", () => {
    expect(sheetProblems(sheet, [row("arroz", {}, "rascunho")])[0]).toContain("não homologado");
    expect(sheetProblems(sheet, [row("arroz")])).toEqual([]);
    expect(canApprove({ authorId: "x", approverId: "y", approverRegistry: null })).toContain("registro");
    expect(canApprove({ authorId: "x", approverId: "x", approverRegistry: "CRN-1" })).toContain("distinta");
    expect(canApprove({ authorId: "x", approverId: "y", approverRegistry: "CRN-1" })).toBeNull();
  });
});
