import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") && !p.includes(".test.") ? [p] : [];
  });
}
const all = files("src").map((f) => [f, readFileSync(f, "utf8")] as const);

describe("NCROSSLINK.1 links internos", () => {
  it("links internos para páginas usam o roteador, nunca <a href> (preserva estado e retorno)", () => {
    const bad = all.flatMap(([f, c]) =>
      [...c.matchAll(/<a\b[^>]*href=["{`]+(\/[a-z][^"`}]*)/g)]
        .map((m) => m[1] ?? "")
        .filter((h) => !/^\/(api\/|__l5e\/)/.test(h))
        .map((h) => `${f}: ${h}`));
    expect(bad).toEqual([]);
  });
  it("destinos convertidos existem como rota", () => {
    for (const r of ["ajuda.tsx", "importacoes.tsx", "alimentacao-escolar_.cozinha.tsx"])
      expect(existsSync(join("src/routes", r)), r).toBe(true);
  });
});
