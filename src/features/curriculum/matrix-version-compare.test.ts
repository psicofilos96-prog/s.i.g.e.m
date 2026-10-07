import { describe, expect, it } from "vitest";
import { compareMatrixVersions, loadLabel } from "./matrix-version-compare";
import type { InstitutionalMatrixItem } from "./curricular-matrix-source";

const it_ = (k: string, q: number | null, comp = "lp"): InstitutionalMatrixItem => ({
  versionId: "v", itemKey: k, position: 1,
  reference: { kind: "componente", componentId: comp, labelSnapshot: comp },
  load: q === null ? null : { quantity: q, unitValueId: "h", unitValueVersion: 1 },
});

describe("NCURR.1 comparação de versões da matriz", () => {
  it("detecta inclusão, retirada e carga alterada", () => {
    const r = compareMatrixVersions([it_("a", 4), it_("b", 2)], [it_("a", 5), it_("c", 1)]);
    expect(r.map((x) => `${x.kind}:${x.itemKey}`)).toEqual(["carga-alterada:a", "retirado:b", "incluido:c"]);
  });
  it("carga ausente → registrada é mudança, e ausência nunca vira zero", () => {
    expect(compareMatrixVersions([it_("a", null)], [it_("a", 0)])[0]!.kind).toBe("carga-alterada");
    expect(loadLabel(it_("a", null))).toBe("Ainda não configurado");
  });
  it("versões idênticas não geram diferença", () => {
    expect(compareMatrixVersions([it_("a", 3)], [it_("a", 3)])).toEqual([]);
  });
  it("troca de componente é referência alterada", () => {
    expect(compareMatrixVersions([it_("a", 3, "lp")], [it_("a", 3, "mt")])[0]!.kind).toBe("referencia-alterada");
  });
});
