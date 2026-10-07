import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { destructiveConfirmText, formatDateBR, BUTTON_VARIANT } from "./ui-vocabulary";
describe("NUI.1 vocabulário", () => {
  it("destrutivo exige consequência", () => {
    expect(() => destructiveConfirmText("Excluir", " ")).toThrow();
    expect(destructiveConfirmText("Excluir", "Não pode ser desfeito.")).toBe("Excluir? Não pode ser desfeito.");
  });
  it("data ausente nunca vira zero", () => {
    expect(formatDateBR(null)).toBe("Não informado");
    expect(formatDateBR("2026-10-07")).toBe("07/10/2026");
  });
  it("destrutivo usa variante destructive", () => expect(BUTTON_VARIANT.destrutivo).toBe("destructive"));
  it("sem inglês residual nas primitivas", () => {
    for (const f of ["dialog", "pagination", "carousel", "sidebar"]) {
      const s = readFileSync(`src/components/ui/${f}.tsx`, "utf8");
      expect(s).not.toMatch(/>(Close|Previous|Next)( slide)?<|Go to (previous|next) page|Toggle Sidebar|aria-label="pagination"/);
    }
  });
});
