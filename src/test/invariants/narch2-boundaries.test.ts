import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("NARCH.2 fronteiras de módulos", () => {
  it("telas não recriam o helper de chamada ao banco (usam callRpc)", () => {
    const out = execSync(`rg -l "const call = async <T,?>\\(fn: string" src --glob "!*.test.ts" || true`).toString().trim();
    expect(out).toBe("");
  });
});
