import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(p) && !/\.test\./.test(p) ? [p] : [];
  });
}
const src = files("src").map((f) => [f, readFileSync(f, "utf8")] as const);

describe("NASSET.1 assets institucionais", () => {
  it("todo asset importado existe", () => {
    for (const [, c] of src) for (const m of c.matchAll(/@\/assets\/([\w.-]+\.asset\.json)/g))
      expect(existsSync(join("src/assets", m[1] ?? "")), m[1]).toBe(true);
  });
  it("todo asset do projeto é usado", () => {
    for (const a of readdirSync("src/assets"))
      expect(src.some(([, c]) => c.includes(a)), a).toBe(true);
  });
  it("nenhuma imagem externa é carregada no código", () => {
    const bad = src.filter(([, c]) => /https?:\/\/[^"'\s]+\.(png|jpe?g|webp|gif|svg)/i.test(c)).map(([f]) => f);
    expect(bad).toEqual([]);
  });
  it("a vista da cidade é descrita como Cristo de Itaperuna, nunca Cristo Redentor", () => {
    const bad = src.filter(([, c]) => /Cristo Redentor/.test(c)).map(([f]) => f);
    expect(bad).toEqual([]);
  });
});

describe("NASSET.2 fallback das imagens institucionais de fundo", () => {
  it("foto de Itaperuna usada como fundo some se não carregar (sem ícone quebrado na tela ou na impressão)", () => {
    for (const f of ["src/routes/index.tsx", "src/routes/login.tsx", "src/routes/auth.tsx", "src/features/family-portal/student-card-view.tsx", "src/features/workspace/secretary-workspace-page.tsx", "src/features/calendar/calendar-external-sheets.tsx"])
      expect(readFileSync(f, "utf8"), f).toMatch(/onError=\{hideBrokenImage\}/);
  });
});
