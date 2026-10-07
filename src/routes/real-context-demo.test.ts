import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(p, "utf8");

describe("contexto real nunca mostra demonstração", () => {
  it("início: registros ilustrativos só sem sessão", () => {
    const s = src("src/routes/index.tsx");
    expect(s).toContain("useSessionUser");
    expect(s).toMatch(/real \? \(\s*<p[^]*Nenhuma movimentação[^]*\) : \(\s*<>[^]*rows\.map/);
  });
  it("regras avaliativas: fixtures só no ramo sem sessão", () => {
    const s = src("src/routes/regras-avaliativas.tsx");
    expect(s).toMatch(/institutional=\{\(\) => <RealContextRulesEmpty \/>\}\s+laboratory=\{\(\) => <Outlet \/>\}/);
  });
});
