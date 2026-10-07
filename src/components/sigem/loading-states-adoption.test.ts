import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

describe("estados de carregamento padronizados", () => {
  it("nenhuma tela mostra 'Carregando' em parágrafo solto", () => {
    const out = execSync(`rg -n "<p[^>]*>\\s*Carregando[^<{]*</p>" src/features src/routes -g '!*.test.*' || true`).toString();
    expect(out.trim()).toBe("");
  });
});
