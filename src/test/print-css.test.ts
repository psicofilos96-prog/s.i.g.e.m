import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

describe("NDOC.1 — CSS de impressão compartilhado", () => {
  it("não há @page sem nome (paisagem global vazava para toda impressão)", () => {
    expect(css).not.toMatch(/@page\s*\{/);
  });
  it("a folha do calendário usa a página nomeada paisagem", () => {
    expect(css).toMatch(/@page cd-landscape\s*\{\s*size: A4 landscape;/);
    expect(css).toMatch(/\.cd-print-root\s*\{\s*page: cd-landscape;/);
  });
  it("largura 297mm só vale quando a folha do calendário existe", () => {
    expect(css).not.toMatch(/^\s*html,\s*\n\s*body\s*\{[^}]*297mm/m);
  });
});
