import { describe, it, expect } from "vitest";
import { buildMap, type Fact } from "./territorial-map";

const places = [
  { schoolId: "A", regionCode: "R1", lat: -1, lng: -2, coordSource: "cadastro" },
  { schoolId: "B", regionCode: "R1", lat: null, lng: null, coordSource: null },
  { schoolId: "C", regionCode: null, lat: -3, lng: -4, coordSource: "cadastro" },
];
const many = (s: string, n: number, layer: Fact["layer"] = "casos") => Array.from({ length: n }, (_, i) => ({ layer, schoolId: s, studentRef: `${s}${i}` }));
const pol = { minCellSize: 5, decisionRef: "dec-1" };

describe("L18 mapa territorial", () => {
  it("sem limiar homologado o mapa não sai", () => {
    expect(buildMap(many("A", 9), places, "escola", null).status).toBe("bloqueado");
  });
  it("recusa fato com localização de residência", () => {
    const f = [{ ...many("A", 9)[0], lat: 1 } as unknown as Fact];
    expect(buildMap(f, places, "escola", pol).reason).toBe("fato-com-localizacao-pessoal");
  });
  it("conta pessoas distintas, suprime pequenas e aplica supressão complementar", () => {
    const f = [...many("A", 8), ...many("A", 8), ...many("B", 2), ...many("C", 20)];
    const r = buildMap(f, places, "escola", pol);
    const v = Object.fromEntries(r.cells.map((c) => [c.unit, c.value]));
    expect(v["B"]).toBe("suprimido");
    expect(v["A"]).toBe("suprimido"); // menor visível suprimida para B não ser deduzida
    expect(v["C"]).toBe(20);
  });
  it("pontos só da escola com coordenada de fonte; região sem pontos e sem região fica fora", () => {
    const f = [...many("A", 6), ...many("C", 6)];
    expect(buildMap(f, places, "escola", pol).points.map((p) => p.schoolId)).toEqual(["A", "C"]);
    const reg = buildMap(f, places, "regiao", pol);
    expect(reg.points).toEqual([]); expect(reg.unplaced).toBe(6);
  });
});
