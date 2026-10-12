import { describe, expect, it } from "vitest";
import { methodLibrary, buildSeries, comparePoints, visiblePanels, scopeObservations, drill, type Observation, type Period, type MethodEntry } from "./indicator-series";

const per = (id: string, from: string, to: string): Period => ({ id, periodicity: "bimestral", from, to, source: "calendario-2026@v3" });
const P = [per("b1", "2026-02-01", "2026-03-31"), per("b2", "2026-04-01", "2026-05-31")];
const ob = (periodId: string, value: number | null, o: Partial<Observation> = {}): Observation => ({ indicator: "mat", version: 1, schoolId: "A", periodId, value, state: value === null ? "desconhecido" : "disponivel", knownAt: "k", refs: ["r"], ...o });

describe("CIECE L15 indicadores e séries", () => {
  it("biblioteca reaproveita o catálogo e recusa externo sem proveniência", () => {
    const ext: MethodEntry = { key: "ideb", version: 1, theme: "externo", title: "IDEB", formula: "publicado", source: "INEP", provenance: { kind: "externo", publisher: "INEP" }, limitations: [] };
    const lib = methodLibrary(() => "matricula", [ext, { ...ext, key: "ok", provenance: { kind: "externo", publisher: "INEP", doc: "nota", sha256: "h", referenceYear: "2025" } }]);
    expect(lib.entries.filter((e) => e.provenance.kind === "sigem").length).toBeGreaterThan(0);
    expect(lib.refused).toEqual([{ key: "ideb", reason: "externo-sem-proveniencia" }]);
    expect(lib.entries.some((e) => e.key === "ok")).toBe(true);
  });
  it("série só sobre períodos declarados; ponto ausente não vira zero", () => {
    expect(buildSeries("mat", 1, "mensal", "A", P, []).notes).toContain("sem-periodos-mensal-declarados");
    const s = buildSeries("mat", 1, "bimestral", "A", P, [ob("b1", 10)]);
    expect(s.points[1]!.obs).toBeNull(); expect(s.notes).toContain("pontos-sem-observacao-nao-sao-zero");
    expect(buildSeries("mat", 1, "bimestral", "A", P, [ob("b1", 10), ob("b2", 9, { version: 2 })]).notes).toContain("versoes-misturadas-descartadas");
  });
  it("comparação só entre equivalentes, com notas", () => {
    const a = buildSeries("mat", 1, "bimestral", "A", P, [ob("b1", 10), ob("b2", 12)]);
    const b = buildSeries("mat", 1, "bimestral", "B", P, [ob("b1", 7, { schoolId: "B", knownAt: "k2" }), ob("b2", null, { schoolId: "B" })]);
    const c = comparePoints(a, 0, b, 0);
    expect(c.comparable).toBe(true); expect(c.delta).toBe(-3); expect(c.notes).toContain("knownAt-diferentes(limitacao)");
    expect(comparePoints(a, 1, b, 1).comparable).toBe(false);
    const v2 = buildSeries("mat", 2, "bimestral", "A", P, [ob("b1", 1, { version: 2 })]);
    expect(comparePoints(a, 0, v2, 0).notes).toContain("indicador-ou-versao-diferente");
  });
  it("painéis por capacidade e escopo; drill-down só referências", () => {
    const panels = [{ id: "p1", theme: "matriculas" as const, indicators: ["mat"], capability: "consultar-ciece", scope: "rede" as const, drillTo: "/relatorios" }, { id: "p2", theme: "censo" as const, indicators: [], capability: "preparar-censo-escolar", scope: "escola" as const, drillTo: "/secreto" }];
    const escola = { capabilities: new Set(["consultar-ciece", "preparar-censo-escolar"]), schoolScope: new Set(["A"]) };
    expect(visiblePanels(panels, escola, () => false).map((p) => p.id)).toEqual(["p2"]);
    expect(visiblePanels(panels, { ...escola, schoolScope: "rede" }, (p) => p === "/relatorios").map((p) => p.drillTo)).toEqual(["/relatorios", null]);
    expect(scopeObservations([ob("b1", 1), ob("b1", 2, { schoolId: "B" }), ob("b1", 3, { schoolId: null })], escola).map((o) => o.value)).toEqual([1]);
    expect(drill(ob("b1", 1))).toEqual({ indicator: "mat@1", refs: ["r"], knownAt: "k" });
  });
});
