import { describe, expect, it } from "vitest";
import { assertAggregateDemand, buildTerritorialMap, type SchoolPlace } from "./territorial-map";

const places: SchoolPlace[] = [
  { schoolId: "E1", name: "EM A", districtCode: "330210305", location: { lat: -22.1, lng: -41.9, source: "cadastro-v3" }, modalities: ["regular"], stages: ["ef1"] },
  { schoolId: "E2", name: "EM B", districtCode: "330210310", location: null, modalities: ["eja"], stages: ["ef2"] },
  { schoolId: "E3", name: "EM C", districtCode: "330210305", location: { lat: 0, lng: 0, source: "x" }, modalities: ["regular"], stages: ["ei"] },
];
const ind = [{ schoolId: "E1", authorized: 100, occupants: 90, available: 8, waiting: 3 }];
const demand = [{ schoolId: "E1", districtCode: "330210305", count: 12 }, { schoolId: "E2", districtCode: "330210310", count: 2 }];

describe("Mapa territorial L16", () => {
  it("só escolas com coordenada institucional válida viram ponto; demais são lacuna", () => {
    const m = buildTerritorialMap(places, ind, demand, {}, { minCellSize: 5 });
    expect(m.points.map((p) => p.schoolId)).toEqual(["E1"]);
    expect(m.withoutLocation).toEqual(["E2", "E3"]);
    expect(m.points[0]).toMatchObject({ authorized: 100, available: 8, waiting: "suprimido" });
  });
  it("demanda agregada por distrito com supressão; sem limiar ⇒ oculta", () => {
    expect(buildTerritorialMap(places, ind, demand, {}, { minCellSize: 5 }).districtDemand).toEqual([{ districtCode: "330210305", demand: 12 }, { districtCode: "330210310", demand: "suprimido" }]);
    const m = buildTerritorialMap(places, ind, demand, {}, { minCellSize: null });
    expect(m.districtDemand?.every((d) => d.demand === null)).toBe(true);
    expect(m.demandHiddenReason).toBeTruthy();
  });
  it("filtros geográficos, modalidade e etapa", () => {
    expect(buildTerritorialMap(places, ind, null, { districtCodes: ["330210310"] }, { minCellSize: 5 }).withoutLocation).toEqual(["E2"]);
    expect(buildTerritorialMap(places, ind, null, { modalities: ["eja"] }, { minCellSize: 5 }).points).toEqual([]);
    expect(buildTerritorialMap(places, ind, null, { stages: ["ef1"] }, { minCellSize: 5 }).points.length).toBe(1);
  });
  it("recusa qualquer campo individual de estudante na demanda", () => {
    expect(() => assertAggregateDemand([{ schoolId: "E1", districtCode: "x", count: 1, endereco: "Rua" }])).toThrow();
    expect(() => assertAggregateDemand([{ schoolId: "E1", districtCode: "x", count: 1, studentLat: 1 }])).toThrow();
    expect(JSON.stringify(buildTerritorialMap(places, ind, demand, {}, { minCellSize: 5 }))).not.toMatch(/endere|student/i);
  });
});
