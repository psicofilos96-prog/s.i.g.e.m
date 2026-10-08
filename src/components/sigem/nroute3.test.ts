import { describe, it, expect } from "vitest";
import { navigationItems, pageTitleForPath } from "@/config/navigation";
import { readFileSync } from "node:fs";
const TECH = /^\/(api|design-system|diagnostico|laboratorio)/;
describe("NROUTE.3", () => {
  it("menu não oferece rota técnica como produto", () => {
    expect(navigationItems.filter((i) => TECH.test(String(i.to)))).toEqual([]);
  });
  it("todo item do menu tem título de página", () => {
    for (const i of navigationItems) expect(pageTitleForPath(String(i.to)).trim().length).toBeGreaterThan(0);
  });
  it("página não encontrada define título da aba", () => {
    expect(readFileSync("src/routes/__root.tsx", "utf8")).toContain('document.title = "Página não encontrada — SIGEM"');
  });
  it("carregamento da área mantém título principal", () => {
    expect(readFileSync("src/components/app-shell/app-shell.tsx", "utf8")).toMatch(/data-sigem-shell-skeleton[\s\S]{0,200}<h1 className="sr-only">/);
  });
});
