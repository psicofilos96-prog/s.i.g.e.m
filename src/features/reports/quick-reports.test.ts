import { describe, it, expect } from "vitest";
import { QUICK_REPORTS } from "./quick-reports";
import { sourceById } from "./builder-sources";
describe("Relatórios mais usados", () => {
  it("são o Panorama 2026 por escola e o Pessoal por escola e setor, com assunto existente no gerador", () => {
    expect(QUICK_REPORTS.map((q) => q.sourceId)).toEqual(["gerador-panorama-escolas", "gerador-pessoal"]);
    for (const q of QUICK_REPORTS) expect(sourceById(q.sourceId)?.sectors).toContain(q.sector);
  });
});
