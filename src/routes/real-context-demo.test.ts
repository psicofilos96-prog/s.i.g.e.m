import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(p, "utf8");

describe("contexto real nunca mostra demonstração", () => {
  it("início: nenhum registro ilustrativo e leitura só com sessão", () => {
    const s = src("src/routes/index.tsx");
    expect(s).toContain("useSessionUser");
    expect(s).not.toMatch(/demonstrativ|ilustrativ/i);
    expect(s).toMatch(/usePanorama\(!!user\)/);
  });
  it("regras avaliativas: fixtures só no ramo sem sessão", () => {
    const s = src("src/routes/regras-avaliativas.tsx");
    expect(s).toMatch(/institutional=\{\(\) => <AssessmentRulesRealPage \/>\}\s+laboratory=\{\(\) => <Outlet \/>\}/);
  });
});
