import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

describe("NDOCINDEX.1 — índice técnico da documentação", () => {
  it("índice está atualizado e não há referência quebrada", () => {
    const r = spawnSync("node", ["scripts/docs-index.mjs", "--check"], { encoding: "utf8" });
    expect(r.stdout + r.stderr).toContain("Índice e referências OK");
  });
});
