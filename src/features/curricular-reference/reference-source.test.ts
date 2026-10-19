import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ tables: [] as string[] }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    marker: "client",
    from(this: { marker: string } | undefined, table: string) {
      if (this?.marker !== "client") throw new Error("client context lost");
      state.tables.push(table);
      return { select: async () => ({ data: [{ id: table }], error: null }) };
    },
  },
}));
import { readCatalog, readEditorialLayers } from "./reference-source";
describe("Canonical reference client binding", () => {
  it("catalog reads retain the client context and real rows", async () => {
    const result = await readCatalog();
    expect(result.items).toEqual([{ id: "curricular_reference_items" }]);
    expect(result.editions).toEqual([{ id: "curricular_reference_editions" }]);
    expect(state.tables).toContain("curricular_reference_item_bindings");
  });
  it("editorial reads retain the same client context", async () => {
    const result = await readEditorialLayers();
    expect(result.homologations).toEqual([{ id: "curricular_reference_homologations" }]);
  });
});