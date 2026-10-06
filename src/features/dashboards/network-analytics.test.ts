import { describe, expect, it } from "vitest";
import { BLOCKS, capacityView, compare, exportMetadata, qualityPanel, teacherView, territoryStatus, yearNature } from "./network-analytics";
import { NETWORK_INDICATORS } from "./network-indicator-catalog";
import { parseNetworkReading } from "./network-indicator-runtime";

const read = (year: string, ind: Record<string, unknown>) => parseNetworkReading({ as_of: `${year}-06-01`, known_at: "now", year, indicators: ind });
const mat = NETWORK_INDICATORS.find((d) => d.key === "matriculas-vigentes")!;
const ok = (v: number) => ({ state: v === 0 ? "zero" : "available", value: v, source: "school_enrollments" });

describe("AM", () => {
  it("2026 histórico, 2027 operacional só com estado", () => {
    expect(yearNature("2026", null)).toBe("historico-importado");
    expect(yearNature("2027", null)).toBe("sem-estado");
    expect(yearNature("2027", "aberto")).toBe("operacional");
  });
  it("série compara só leituras compatíveis", () => {
    const a = { reading: read("2026", { "matriculas-vigentes": ok(10) }), yearNature: "historico-importado" as const, definitionVersion: 1 };
    const b = { reading: read("2026", { "matriculas-vigentes": ok(12) }), yearNature: "historico-importado" as const, definitionVersion: 1 };
    expect(compare(mat, a, b)).toEqual({ kind: "comparavel", delta: 2 });
    expect(compare(mat, a, { ...b, yearNature: "operacional" }).kind).toBe("nao-comparavel");
    expect(compare(mat, a, { ...b, definitionVersion: 2 }).kind).toBe("nao-comparavel");
  });
  it("unknown nunca vira zero; zero comprovado compara", () => {
    const z = { reading: read("2026", { "matriculas-vigentes": ok(0) }), yearNature: "historico-importado" as const, definitionVersion: 1 };
    const u = { reading: read("2026", { "matriculas-vigentes": { state: "unknown", value: null, source: "school_enrollments", reason: "sem início efetivo" } }), yearNature: "historico-importado" as const, definitionVersion: 1 };
    expect(compare(mat, z, z)).toEqual({ kind: "comparavel", delta: 0 });
    expect(compare(mat, z, u).kind).toBe("nao-comparavel");
  });
  it("qualidade separada e classificada; unavailable→available sai do painel", () => {
    const r = read("2027", { "mapa-oficial": { state: "unavailable", reason: "Sem regra homologada", source: "x" } });
    const q = qualityPanel(r);
    expect(q["nao-homologado"].map((s) => s.key)).toContain("mapa-oficial");
    const r2 = read("2027", { "mapa-oficial": ok(5) });
    expect(qualityPanel(r2)["nao-homologado"].map((s) => s.key)).not.toContain("mapa-oficial");
  });
  it("bloqueios explícitos", () => {
    const r = read("2026", { "matriculas-vigentes": ok(9811) });
    expect(capacityView(r, null)).toMatchObject({ demand: 9811, capacity: null, status: BLOCKS.capacity });
    expect(teacherView(r, false).contractualBalance).toBe(BLOCKS.contractual);
    expect(territoryStatus([{ latitude: null, longitude: null }])).toBe(BLOCKS.territory);
    expect(territoryStatus([])).toBe(BLOCKS.territory);
  });
  it("exportação carrega asOf/knownAt e não se diz oficial", () => {
    const m = exportMetadata(read("2026", {}), "historico-importado");
    expect(m.find((x) => x["campo"] === "Conhecido até")??.["valor"]).toBe("now");
    expect(m.find((x) => x["campo"] === "Documento oficial")??.["valor"]).toMatch(/não/);
  });
});
