import { describe, expect, it } from "vitest";
import { BLOCKS, capacityView, compare, exportMetadata, qualityPanel, teacherView, territoryStatus, yearNature } from "./network-analytics";
import { NETWORK_INDICATORS } from "./network-indicator-catalog";
import { parseNetworkReading } from "./network-indicator-runtime";

const read = (year: string, ind: Record<string, unknown>) => parseNetworkReading({ as_of: `${year}-06-01`, known_at: "now", year, indicators: ind });
const mat = NETWORK_INDICATORS.find((d) => d.key === "matriculas-vigentes")!;
const ok = (v: number) => ({ state: v === 0 ? "zero" : "available", value: v, source: "school_enrollments" });

describe("AM", () => {
  it("2026 histórico, 2027 operacional só com estado", () => {
    expect(yearNature("historico-importado")).toBe("historico-importado");
    expect(yearNature(null)).toBe("sem-estado");
    expect(yearNature("aberto")).toBe("sem-estado");
    expect(yearNature("operacional")).toBe("operacional");
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
    expect(m.find((x) => x["campo"] === "Conhecido até")?.["valor"]).toBe("now");
    expect(m.find((x) => x["campo"] === "Documento oficial")?.["valor"]).toMatch(/não/);
  });
});

import { readFileSync } from "node:fs";
import { ANALYTICS_BLOCKS, analyticsCsv, compareAll, displayState, displayValue, pointOf } from "./network-analytics";

describe("BE — integração à experiência", () => {
  const r = read("x", {
    "matriculas-vigentes": ok(0),
    "mapa-oficial": { state: "unknown", value: null, source: "x", reason: "fora do seu alcance" },
  });
  it("ZERO, UNKNOWN, UNAVAILABLE e BLOCKED distintos; só zero mostra número", () => {
    const m = r.indicators.find((i) => i.key === "matriculas-vigentes")!;
    const u = r.indicators.find((i) => i.key === "mapa-oficial")!;
    const missing = r.indicators.find((i) => i.state === "unavailable")!;
    expect([displayState(m), displayValue(m)]).toEqual(["ZERO", "0"]);
    expect([displayState(u), displayValue(u)]).toEqual(["UNKNOWN", "—"]);
    expect([displayState(missing), displayValue(missing)]).toEqual(["UNAVAILABLE", "—"]);
    expect(ANALYTICS_BLOCKS.map((b) => b.code)).toEqual(expect.arrayContaining(["CONTRACTUAL_BALANCE", "MAX_CAPACITY", "TERRITORIAL_DATA_PENDING", "CONTENT_SOURCE_PENDING"]));
  });
  it("GPE não aparece como arquivo/bloqueio obrigatório", () => {
    expect(JSON.stringify(ANALYTICS_BLOCKS)).not.toMatch(/GPE/);
  });
  it("histórico × operacional e escolas diferentes não se comparam", () => {
    const a = pointOf(r, "historico-importado");
    const all = compareAll(a, pointOf(r, "operacional"));
    expect(all.every((c) => c.result.kind === "nao-comparavel")).toBe(true);
    const other = parseNetworkReading({ as_of: "x", known_at: "y", school: "esc-b", indicators: { "matriculas-vigentes": ok(0) } });
    expect(compareAll(a, pointOf(other, "historico-importado")).find((c) => c.key === "matriculas-vigentes")?.result).toMatchObject({ reason: expect.stringMatching(/Recortes/) });
  });
  it("export pelo report-engine: só linhas lidas, metadados e rótulo de projeção", () => {
    const csv = analyticsCsv(r, "historico-importado", () => "Escola", new Date("2026-10-06T00:00:00Z"));
    for (const t of ["Situação em", "Conhecido até", "Recorte: rede", "Natureza do ano: Histórico (importado)", "Fonte:", "projeção dinâmica"]) expect(csv).toContain(t);
    const lines = csv.split("\r\n"); const dataLines = lines.slice(lines.indexOf("") + 2);
    expect(dataLines.length).toBe(r.indicators.length);
    expect(csv).toContain("não disponível");
  });
  it("tela consome o módulo (sem regra órfã)", () => {
    const page = readFileSync("src/features/dashboards/executive-dashboard-page.tsx", "utf8");
    for (const f of ["qualityPanel", "compareAll", "analyticsCsv", "ANALYTICS_BLOCKS", "yearNature"]) expect(page).toContain(f);
    expect(page).not.toMatch(/ranking|score/i);
  });
});
