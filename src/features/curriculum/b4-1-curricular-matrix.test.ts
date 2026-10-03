import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));

import {
  canMaintainMatrices,
  describeLoad,
  humanMatrixError,
  loadInstitutionalMatrices,
  mapItemRow,
  mapMatrixRow,
  mapLayout,
  leafColumns,
  cellText,
} from "./curricular-matrix-source";

const cap = (capabilityId: string, schoolId: string | null) => ({
  capabilityId, schoolId, engagementId: "e", policyId: "p", policyVersion: 2, classId: null, periodId: null, componentId: null,
});

describe("B4.1 — fonte institucional da matriz", () => {
  it("exige validOn e knownAt explícitos (falha fechada)", async () => {
    await expect(loadInstitutionalMatrices({ validOn: "", knownAt: "2026-01-01T00:00:00Z" })).rejects.toThrow("matrix:context-required");
    await expect(loadInstitutionalMatrices({ validOn: "2026-01-01", knownAt: "" })).rejects.toThrow("matrix:context-required");
  });

  it("carga ausente nunca vira zero", () => {
    const item = mapItemRow({ version_id: "v", item_key: "a", position: 0, component_id: "comp-1", component_label_snapshot: "C", quantity: null, unit_value_id: null });
    expect(item.load).toBeNull();
    expect(describeLoad(item)).toBe("Carga não registrada");
  });

  it("item referencia componente por ID; snapshot é só evidência", () => {
    const item = mapItemRow({ version_id: "v", item_key: "a", position: 0, component_id: "comp-1", component_label_snapshot: "Nome antigo" });
    expect(item.reference).toEqual({ kind: "componente", componentId: "comp-1", labelSnapshot: "Nome antigo" });
  });

  it("mapeia versão com término efetivo derivado", () => {
    const m = mapMatrixRow({ matrix_id: "mat-1", version_id: "x", version: 2, change_kind: "sucessao", official_name: "M", valid_from: "2027-01-01", valid_until: null, effective_until: null, originating_act_ref: "a", created_at: "t" });
    expect(m.effectiveUntil).toBeNull();
    expect(m.changeKind).toBe("sucessao");
  });

  it("capability só com alcance de rede e só a específica da matriz", () => {
    expect(canMaintainMatrices([cap("manter-matrizes-curriculares", null)])).toBe(true);
    expect(canMaintainMatrices([cap("manter-matrizes-curriculares", "esc-1")])).toBe(false);
    expect(canMaintainMatrices([cap("manter-componentes-curriculares", null)])).toBe(false);
  });

  it("mensagens explicam dependência normativa e ambiguidade", () => {
    expect(humanMatrixError("matrix:unit-not-homologated")).toMatch(/unidade de carga homologada/);
    expect(humanMatrixError("matrix:ambiguous")).toMatch(/recusada/);
    expect(humanMatrixError("matrix:school-inactive")).toMatch(/toda a vigência/);
    expect(humanMatrixError("matrix:academic-year-inactive")).toMatch(/toda a vigência/);
    expect(humanMatrixError("matrix:retification-must-start-after-predecessor")).toMatch(/versão anterior/);
  });

  it("B4.1.1: correção é migration nova; 0005 não foi editada para isso", () => {
    const fix = readFileSync("drizzle/migrations/0006_b4_1_1_matrix_validity_hardening.sql", "utf8");
    expect(fix).toMatch(/b41_school_active_throughout/);
    expect(fix).toMatch(/b41_year_active_throughout/);
    expect(fix).toMatch(/retification-must-start-after-predecessor/);
    const orig = readFileSync("drizzle/migrations/0005_b4_1_curricular_matrix_structure.sql", "utf8");
    expect(orig).not.toMatch(/b41_school_active_throughout/);
  });

  it("fonte não importa fixtures de laboratório", () => {
    const src = readFileSync("src/features/curriculum/curricular-matrix-source.ts", "utf8");
    const ui = readFileSync("src/features/curriculum/institutional-matrices.tsx", "utf8");
    for (const s of [src, ui]) {
      expect(s).not.toMatch(/from ["'][^"']*(curriculum-data|matrix-draft)/);
    }
  });

  it("rotas com sessão usam a tela institucional, sem sessão o laboratório", () => {
    for (const f of ["src/routes/matrizes-curriculares.index.tsx", "src/routes/matrizes-curriculares.$id.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s).toMatch(/ClassRouteGate/);
      expect(s).toMatch(/institutional=\{\(\) => <InstitutionalMatri/);
    }
  });
});

describe("B4.1.2 — quadro genérico da matriz", () => {
  const raw = {
    version_id: "v1",
    source: { act: "Ato", locator: "Anexo", page: null, sha256: null },
    columns: [{ key: "a", parent: null, header: "A" }, { key: "a1", parent: "a", header: "A1" }, { key: "a2", parent: "a", header: "A2" }, { key: "b", parent: null, header: "B" }],
    groups: [], rows: [{ key: "r", group: null, role: "item", item: "i", label: null }, { key: "t", group: null, role: "total", item: null, label: "Total" }],
    cells: [{ row: "r", column: "a1", text: "X", number: null }, { row: "r", column: "b", text: "*", number: null }, { row: "t", column: "a1", text: "40", number: 40 }],
    notes: [{ key: "n", marker: "*", text: "nota" }],
  };

  it("símbolos ficam como texto; número só quando literal", () => {
    const l = mapLayout(raw)!;
    expect(l.cells.find((c) => c.text === "X")!.number).toBeNull();
    expect(l.cells.find((c) => c.text === "*")!.number).toBeNull();
    expect(l.cells.find((c) => c.text === "40")!.number).toBe(40);
  });

  it("célula ausente é ausência (null), nunca vazio ou zero", () => {
    const l = mapLayout(raw)!;
    expect(cellText(l, "r", "a2")).toBeNull();
    expect(cellText(l, "r", "a1")).toBe("X");
  });

  it("colunas-folha respeitam agrupamento, sem limite fixo de colunas", () => {
    expect(leafColumns(mapLayout(raw)!).map((c) => c.key)).toEqual(["a1", "a2", "b"]);
    const many = { ...raw, columns: Array.from({ length: 12 }, (_, i) => ({ key: `f${i}`, parent: null, header: `F${i}` })) };
    expect(leafColumns(mapLayout(many)!)).toHaveLength(12);
  });

  it("sem quadro registrado, leitura devolve null (nada inventado)", () => {
    expect(mapLayout(null)).toBeNull();
  });

  it("mensagens do quadro", () => {
    expect(humanMatrixError("matrix:layout-quantity-belongs-to-cells")).toMatch(/células/);
    expect(humanMatrixError("matrix:layout-item-without-row")).toMatch(/linha/);
  });

  it("extensão é migration nova; 0005/0006 intactas e sem conteúdo de deliberação", () => {
    const m = readFileSync("drizzle/migrations/0007_b4_1_2_matrix_layout_grid.sql", "utf8");
    expect(m).toMatch(/curricular_matrix_layout_cells/);
    expect(m).not.toMatch(/INSERT INTO public\.(curricular_matrix_versions|attribute_value_definitions)/);
    for (const f of ["0005_b4_1_curricular_matrix_structure.sql", "0006_b4_1_1_matrix_validity_hardening.sql"]) {
      expect(readFileSync(`drizzle/migrations/${f}`, "utf8")).not.toMatch(/layout/);
    }
  });
});
