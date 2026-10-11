import { describe, expect, it } from "vitest";
import { panorama, breakdownTotal, mapPoint, resolveTerritory, drillDown } from "./observatory";

const cat = {
  municipalities: [{ code: "3302205", ufCode: "33", name: "Itaperuna" }],
  districts: [{ code: "330220505", municipalityCode: "3302205", name: "Itaperuna" }, { code: "330220510", municipalityCode: "3302205", name: "Boaventura" }],
};

describe("observatório", () => {
  it("zero lido ≠ não apurado ≠ sem permissão", () => {
    const c = panorama({ escolas: { state: "lido", value: 55, source: "institutional_schools", referenceDate: "2026-10-11" }, pendencias: { state: "lido", value: 0, source: "x", referenceDate: "2026-10-11" }, servidores: { state: "sem-permissao", reason: "x" } });
    expect(Object.fromEntries(c.map((x) => [x.key, x.display]))).toMatchObject({ escolas: "55", pendencias: "0", servidores: "sem permissão", turmas: "não apurado" });
  });
  it("total por etapa só com todas as linhas", () => {
    expect(breakdownTotal([{ group: "EI", value: 3 }, { group: "EF", value: null }])).toBeNull();
    expect(breakdownTotal([{ group: "EI", value: 3 }, { group: "EF", value: 0 }])).toBe(3);
  });
  it("mapa só com coordenada verificada", () => {
    expect(mapPoint(null)).toEqual({ blocked: "sem coordenada no cadastro" });
    expect(mapPoint({ lat: -21.2, lng: -41.9, verifiedBy: null })).toEqual({ blocked: "coordenada não verificada" });
    expect(mapPoint({ lat: 0, lng: 0, verifiedBy: "p" })).toEqual({ blocked: "coordenada inválida" });
    expect(mapPoint({ lat: -21.2, lng: -41.9, verifiedBy: "p" })).toEqual({ lat: -21.2, lng: -41.9 });
  });
  it("território: código prevalece, nome só inequívoco, vazio vai para fila", () => {
    expect(resolveTerritory(cat, { municipalityCode: "3302205", district: "boaventura" }).distrito).toEqual({ kind: "nome-inequivoco", code: "330220510" });
    expect(resolveTerritory(cat, { municipalityCode: "3302205", districtCode: "330999999" }).distrito.kind).toBe("fila");
    expect(resolveTerritory(cat, { municipalityCode: "3302205", district: "" }).distrito).toEqual({ kind: "fila", reason: "sem-dado" });
    expect(resolveTerritory(cat, { municipalityName: "Itaperuna" }).municipio.kind).toBe("fila");
  });
  it("drill-down mantém ausente como ausente", () => {
    expect(drillDown("matriculas", [{ schoolId: "A", reading: { state: "nao-lido", reason: "" } }], { from: "2026-01-01", to: "2026-12-31" }).rows[0]!.display).toBe("não apurado");
  });
});
