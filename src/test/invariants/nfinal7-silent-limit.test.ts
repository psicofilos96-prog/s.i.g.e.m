import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : []; });
}

describe("NFINAL.7 — leitura acima de 1000 linhas", () => {
  it("nenhuma consulta pede .limit(>1000), que o servidor corta em silêncio; usa readPages", () => {
    const bad = files("src").filter((f) => !f.endsWith("list-paging.ts")).filter((f) => /\.limit\(\s*(\d{5,}|[2-9]\d{3}|1\d{3})\s*\)/.test(readFileSync(f, "utf8")) && !/\.limit\(\s*1000\s*\)/.test(readFileSync(f, "utf8").match(/\.limit\(\s*\d+\s*\)/)?.[0] ?? ""));
    expect(bad).toEqual([]);
  });
});
