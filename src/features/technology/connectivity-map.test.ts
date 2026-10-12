import { describe, expect, it } from "vitest";
import { aggregateByNetwork, geoLayer, schoolStates } from "./connectivity-map";

const schools = [
  { id: "a", location_kind: "urbana", administrative_dependency: "municipal" },
  { id: "b", location_kind: "rural", administrative_dependency: "municipal" },
  { id: "c", location_kind: null, administrative_dependency: null },
];
const links = [{ id: "L", schoolId: "a", provider: "P", contractedDown: null, contractedUp: null, validFrom: "2026-01-01", validUntil: null },
  { id: "M", schoolId: "b", provider: "P", contractedDown: null, contractedUp: null, validFrom: "2026-01-01", validUntil: null }];
const ms = [{ id: "1", linkId: "L", at: "2026-03-01", downMbps: 40, upMbps: null, latencyMs: null, available: true, personId: "x" },
  { id: "2", linkId: "M", at: "2026-03-01", downMbps: 5, upMbps: null, latencyMs: null, available: true, personId: "x" }];
const vs = [{ measurementId: "1", verdict: "confirmada" as const, personId: "y" }];

describe("L14 mapa de conectividade", () => {
  const rows = schoolStates(schools, links, ms, vs);
  it("estado só de medição verificada; sem link e sem verificação distintos", () => {
    expect(rows.map((r) => r.state)).toEqual(["medida", "sem-medicao-verificada", "sem-link"]);
    expect(rows[1]!.bestDownMbps).toBeNull();
  });
  it("agrega por rede do cadastro e mantém não classificada à parte", () => {
    const g = aggregateByNetwork(rows, null);
    expect(g.find((x) => x.key === "municipal-urbana")).toMatchObject({ schools: 1, medidas: 1, medianDownMbps: 40 });
    expect(g.find((x) => x.key === "nao-classificada")!.schools).toBe(1);
  });
  it("grupo abaixo do limiar declarado é suprimido; sem limiar não suprime", () => {
    expect(aggregateByNetwork(rows, 2).find((x) => x.key === "rural")).toMatchObject({ suppressed: true, medidas: null });
  });
  it("sem coordenadas reais a camada geográfica é recusada", () => {
    expect(geoLayer(schools, rows).available).toBe(false);
    const g = geoLayer([{ id: "a", lat: -21.2, lng: -41.9 }, { id: "b", lat: 999, lng: 0 }], rows);
    expect(g.available && g.excluded).toBe(1);
  });
});
