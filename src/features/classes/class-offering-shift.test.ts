import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { canMaintainOffering, canMaintainShift, projectOffering, projectShift } from "./class-offering-shift-source";
import { canMaintainCatalogs, groupCatalog } from "@/features/institutional-admin/institutional-catalog-source";

const base = { logical_id: "o1", version: 1, valid_from: "2026-02-01", valid_until: null, correction_reason: null, originating_act_ref: "a", created_at: "t" };

describe("B2.6 — Oferta e Turno", () => {
  it("ausência permanece ausência", () => {
    expect(projectOffering([])).toBeNull();
    expect(projectShift([])).toBeNull();
  });
  it("agrupa eixos de uma versão e recusa estado ambíguo", () => {
    const o = projectOffering([
      { ...base, offering_version_id: "v1", scheme_id: "modalidade", value_id: "m", value_version: 1, value_label: "M" },
      { ...base, offering_version_id: "v1", scheme_id: "etapa", value_id: "e", value_version: 1, value_label: "E" },
    ]);
    expect(o?.axes.map((a) => a.schemeId)).toEqual(["etapa", "modalidade"]);
    expect(() => projectOffering([
      { ...base, offering_version_id: "v1", scheme_id: "etapa", value_id: "e", value_version: 1, value_label: null },
      { ...base, offering_version_id: "v2", scheme_id: "etapa", value_id: "e", value_version: 1, value_label: null },
    ])).toThrow(/ambiguous/);
    expect(() => projectShift([
      { ...base, shift_version_id: "a", value_id: "x", value_version: 1, value_label: null },
      { ...base, shift_version_id: "b", value_id: "y", value_version: 1, value_label: null },
    ])).toThrow(/ambiguous/);
  });
  it("capacidades independentes e escopadas", () => {
    const caps = [{ capabilityId: "manter-turno-da-turma", schoolId: "s1" }] as never;
    expect(canMaintainShift(caps, "s1")).toBe(true);
    expect(canMaintainShift(caps, "s2")).toBe(false);
    expect(canMaintainOffering(caps, "s1")).toBe(false);
    expect(canMaintainCatalogs([{ capabilityId: "manter-catalogos-institucionais", schoolId: "s1" }] as never)).toBe(false);
  });
  it("catálogo vazio é estado válido; versões agrupadas por valor", () => {
    expect(groupCatalog([])).toEqual([]);
    const g = groupCatalog([
      { schemeId: "turno", valueId: "x", version: 2, label: "X2", status: "homologada", homologationActRef: "a", validFrom: null, changeReason: "r", createdAt: "" },
      { schemeId: "turno", valueId: "x", version: 1, label: "X1", status: "rascunho", homologationActRef: null, validFrom: null, changeReason: null, createdAt: "" },
    ]);
    expect(g[0]!.values[0]!.latest.version).toBe(2);
  });
});
