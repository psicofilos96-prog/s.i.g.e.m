import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(p, "utf8");
describe("NMOBILE.1 — regressão de responsividade", () => {
  it("diálogos cabem na tela (teclado aberto, zoom 200%) e rolam por dentro", () => {
    for (const f of ["src/components/ui/dialog.tsx", "src/components/ui/alert-dialog.tsx"]) {
      const s = read(f);
      expect(s).toContain("max-h-[calc(100dvh-1.5rem)]");
      expect(s).toContain("overflow-y-auto");
      expect(s).toContain("w-[calc(100%-1.5rem)]");
    }
  });
  it("botão do calendário no campo de data tem alvo de toque de 36px", () => {
    const s = read("src/components/sigem/date-input.tsx");
    expect(s).toMatch(/data-touch-target="date-picker"\s+className="[^"]*h-9 w-9/);
  });
});
