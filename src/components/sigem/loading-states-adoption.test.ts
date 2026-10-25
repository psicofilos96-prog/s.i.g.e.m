import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

describe("estados de carregamento padronizados", () => {
  it("nenhuma tela mostra 'Carregando' em parágrafo solto", () => {
    const r = spawnSync("rg", ["-n", String.raw`<p[^>]*>\\s*Carregando[^<{]*</p>`, "src/features", "src/routes", "-g", "!*.test.*"], { encoding: "utf8" });
    const out = r.status === 1 ? "" : `${r.stdout ?? ""}${r.stderr ?? ""}`;
    expect(out.trim()).toBe("");
  });
});
