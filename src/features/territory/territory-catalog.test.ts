import { describe, expect, it } from "vitest";
import { preflightTerritorial, reconcileMunicipality, validCode } from "./territory-catalog";

const cat = [
  { code: "3302205", ufCode: "33", name: "Itaperuna" },
  { code: "2930204", ufCode: "29", name: "São Domingos" },
  { code: "4216255", ufCode: "42", name: "São Domingos" },
];

describe("catálogo territorial IBGE", () => {
  it("código só como texto e com comprimento exato (zeros preservados)", () => {
    expect(validCode("municipio", "3302205")).toBe("3302205");
    expect(validCode("distrito", "110001505")).toBe("110001505");
    expect(validCode("municipio", 3302205 as unknown as string)).toBeNull();
    expect(validCode("uf", "3")).toBeNull();
  });
  it("Itaperuna casa por código; código inexistente vai para fila", () => {
    expect(reconcileMunicipality(cat, { code: "3302205" })).toEqual({ kind: "codigo", code: "3302205" });
    expect(reconcileMunicipality(cat, { code: "3399999" })).toMatchObject({ kind: "fila", reason: "codigo-inexistente" });
  });
  it("homônimo nunca é escolhido; nome só casa com UF e único", () => {
    expect(reconcileMunicipality(cat, { name: "Sao Domingos" })).toMatchObject({ kind: "fila", reason: "nome-sem-uf", candidates: ["2930204", "4216255"] });
    expect(reconcileMunicipality(cat, { name: "ITAPERUNA", ufCode: "33" })).toEqual({ kind: "nome-inequivoco", code: "3302205" });
    expect(reconcileMunicipality(cat, { name: "Itaperuna" })).toMatchObject({ kind: "fila", reason: "nome-sem-uf" });
  });
  it("preflight exige ano e só cobra distrito quando o leiaute o declara obrigatório", () => {
    expect(preflightTerritorial([], () => true, null)).toEqual([{ field: "*", code: "territorio:ano-do-catalogo-ausente" }]);
    const known = (_: string, c: string) => c !== "510624017"; // distrito extinto em 2024
    expect(preflightTerritorial([
      { field: "municipio", level: "municipio", value: "3302205", required: true },
      { field: "distrito", level: "distrito", value: null, required: false },
      { field: "distrito2", level: "distrito", value: "510624017", required: false },
    ], known, 2024)).toEqual([{ field: "distrito2", code: "territorio:inexistente-no-ano" }]);
  });
});
