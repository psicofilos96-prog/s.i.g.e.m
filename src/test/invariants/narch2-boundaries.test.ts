import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("NARCH.2 fronteiras de módulos", () => {
  it("telas não recriam o helper de chamada ao banco (usam callRpc)", () => {
    const out = spawnSync("rg", ["-l", String.raw`const call = async <T,?>\(fn: string`, "src", "--glob", "!*.test.ts"], { encoding: "utf8" });
    const result = out.status === 1 ? "" : `${out.stdout ?? ""}${out.stderr ?? ""}`.trim();
    expect(result).toBe("");
  });
});
