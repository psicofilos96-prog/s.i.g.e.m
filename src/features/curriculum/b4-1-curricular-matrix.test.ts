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
  });

  it("fonte não importa fixtures de laboratório", () => {
    const src = readFileSync("src/features/curriculum/curricular-matrix-source.ts", "utf8");
    const ui = readFileSync("src/features/curriculum/institutional-matrices.tsx", "utf8");
    for (const s of [src, ui]) {
      expect(s).not.toMatch(/curriculum-data|matrix-draft/);
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
