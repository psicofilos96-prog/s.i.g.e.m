import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { stationAllowsPath } from "@/features/authority/station-navigation";

describe("NNAV.2 — continuidade de navegação", () => {
  it("trilha só vira link quando a estação permite o destino", () => {
    const src = readFileSync("src/components/sigem/operational.tsx", "utf8");
    expect(src).toMatch(/stationAllowsPath\(principal\.station, parent\.to\)/);
    expect(stationAllowsPath("supervisao", "/matrizes-curriculares")).toBe(false);
    expect(stationAllowsPath("supervisao", "/")).toBe(true);
  });
  it("item ativo do menu é anunciado como página atual", () => {
    expect(readFileSync("src/components/app-shell/app-shell.tsx", "utf8")).toContain('aria-current={isActive ? "page" : undefined}');
  });
});
