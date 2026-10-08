import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const bell = readFileSync("src/features/notifications/notification-bell.tsx", "utf8");
describe("Revisão Busca/Notificações", () => {
  it("sino de avisos tem área de toque de 44 px em tela de toque (NMOBILE.2)", () => {
    expect(bell).toContain("pointer-coarse:h-11 pointer-coarse:w-11");
  });
  it("contador só aparece com não lidos; sem leitura não exibe zero", () => {
    expect(bell).toMatch(/n > 0 &&/);
    expect(bell).not.toMatch(/>\{n\}<|Avisos: 0/);
  });
});
