import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}
const all = files("src");

describe("NCSS.2 tokens visuais", () => {
  it("tamanhos 10/11px usam os tokens text-2xs/text-micro, não valores avulsos", () => {
    const bad = all.filter((f) => /text-\[(0\.625rem|10px|0\.6875rem|11px)\]/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
  it("tokens tipográficos existem no tema", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/--text-2xs:\s*0\.625rem/);
    expect(css).toMatch(/--text-micro:\s*0\.6875rem/);
  });
  it("controle que remove o contorno de foco oferece foco visível substituto", () => {
    const nav = readFileSync("src/components/ui/navigation-menu.tsx", "utf8");
    expect(nav).toMatch(/focus-visible:ring-2/);
  });
});
