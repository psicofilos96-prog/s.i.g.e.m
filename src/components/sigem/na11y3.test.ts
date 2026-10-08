import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
describe("NA11Y.3", () => {
  it("CIECE mantém título principal em carregamento e erro", () => {
    const s = readFileSync("src/routes/ciece.tsx", "utf8");
    expect(s.match(/<h1 className="sr-only">CIECE/g)?.length).toBeGreaterThanOrEqual(4);
  });
  it("seletor de escola da Qualidade não ultrapassa a largura com zoom 200%", () => {
    expect(readFileSync("src/features/data-quality/quality-page.tsx", "utf8")).toMatch(/<select className="[^"]*w-full max-w-full/);
  });
});
