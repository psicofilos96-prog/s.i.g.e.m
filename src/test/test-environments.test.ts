import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DOM_TS_TESTS } from "../../vitest.config";

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe("NPERF.TEST.1 — cobertura dos ambientes de teste", () => {
  it("todo .ts listado como DOM existe (lista não vira exclusão silenciosa)", () => {
    for (const f of DOM_TS_TESTS) expect(existsSync(f), f).toBe(true);
  });
  it("todo arquivo de teste cai em exatamente um projeto (node .ts ou dom .tsx+lista)", () => {
    const all = walk("src").filter((p) => /\.test\.tsx?$/.test(p));
    const node = all.filter((p) => p.endsWith(".ts") && !DOM_TS_TESTS.includes(p));
    const dom = all.filter((p) => p.endsWith(".tsx") || DOM_TS_TESTS.includes(p));
    expect(node.length + dom.length).toBe(all.length);
    expect(node.filter((p) => dom.includes(p))).toEqual([]);
  });
});
