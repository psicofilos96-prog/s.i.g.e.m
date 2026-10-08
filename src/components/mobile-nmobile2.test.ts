import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(p, "utf8");
describe("NMOBILE.2 — alvo de toque mínimo de 44px em ponteiro grosso", () => {
  it("componentes compartilhados crescem para 44px no toque", () => {
    expect(read("src/components/ui/button.tsx")).toContain('icon: "size-9 shrink-0 pointer-coarse:size-11"');
    expect(read("src/components/ui/input.tsx")).toContain("pointer-coarse:h-11");
    expect(read("src/components/ui/select.tsx")).toContain("pointer-coarse:min-h-11");
    expect(read("src/components/ui/checkbox.tsx")).toContain("pointer-coarse:after:-inset-3.5");
    expect(read("src/components/ui/breadcrumb.tsx")).toContain("pointer-coarse:min-w-11");
    const d = read("src/components/sigem/date-input.tsx");
    expect(d).toContain("pointer-coarse:h-11 pointer-coarse:w-11");
    expect(d).toContain("pointer-coarse:h-11 w-full");
    expect(read("src/features/help/help-components.tsx").match(/pointer-coarse:min-h-11/g)?.length).toBe(3);
  });
  it("link 'Histórico de aulas e experiências' da home do Diário tem alvo de toque", () => {
    expect(read("src/features/diary/diary-journey-view.tsx")).toMatch(/pointer-coarse:min-h-11[^"]*"\s*>\s*Histórico de aulas e experiências/);
  });
  it("teclado virtual redimensiona o conteúdo e campos focados ficam afastados das bordas", () => {
    expect(read("src/routes/__root.tsx")).toContain("interactive-widget=resizes-content");
    expect(read("src/styles.css")).toContain("scroll-margin-block: 6rem");
  });
});
