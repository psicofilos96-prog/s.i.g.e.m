import { describe, expect, it } from "vitest";
import { CATALOG, suggestReports } from "./report-catalog";

describe("assistente de relatórios", () => {
  it("pergunta sem palavra útil não sugere nada", () => expect(suggestReports(CATALOG, "quero um relatório")).toEqual([]));
  it("sugere só entradas do catálogo, no máximo 5", () => {
    const r = suggestReports(CATALOG, "censo escolar escola");
    expect(r.length).toBeGreaterThan(0); expect(r.length).toBeLessThanOrEqual(5);
    for (const e of r) expect(CATALOG).toContain(e);
  });
  it("termo inexistente devolve vazio, nunca inventa", () => expect(suggestReports(CATALOG, "xyzqwv")).toEqual([]));
});
