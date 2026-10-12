import { describe, expect, it } from "vitest";
import { buildTimeline, reportStatus, TECH_REPORTS, validFilters } from "./tech-reports";

describe("L23 relatórios de tecnologia", () => {
  it("são 22, chaves únicas, com fonte, metodologia, data e filtros", () => {
    expect(TECH_REPORTS).toHaveLength(22);
    expect(new Set(TECH_REPORTS.map((r) => r.key)).size).toBe(22);
    for (const r of TECH_REPORTS) {
      expect(r.sources.length).toBeGreaterThan(0);
      expect(r.methodology.length).toBeGreaterThan(10);
      expect(r.dateBasis).not.toBe("");
      expect(r.filters.length).toBeGreaterThan(0);
    }
  });
  it("dependência ausente bloqueia", () => {
    const sla = TECH_REPORTS.find((r) => r.key === "t03")!;
    expect(reportStatus(sla, new Set()).status).toBe("bloqueado");
    expect(reportStatus(sla, new Set(["politica-sla-aprovada"])).status).toBe("disponivel");
  });
  it("recusa filtro não declarado", () => {
    expect(validFilters(TECH_REPORTS[0]!, { escola: "x", servico: "y" })).toEqual(["servico"]);
  });
  it("linha do tempo ordena e conta itens sem data", () => {
    const t = buildTimeline([{ at: "2026-02-01", source: "a", label: "2" }, { at: "2026-01-01", source: "a", label: "1" }, { at: "", source: "a", label: "x" }]);
    expect(t.items.map((i) => i.label)).toEqual(["1", "2"]);
    expect(t.undated).toBe(1);
  });
});
