import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const panel = readFileSync("src/features/institutional-admin/activation-codes-panel.tsx", "utf8");
const fn = readFileSync("src/features/institutional-admin/activation.functions.ts", "utf8");
describe("links de ativação são credenciais: sem exportação em massa", () => {
  it("não existe download de lista de links", () => {
    expect(panel).not.toMatch(/createObjectURL|download\s*=|Baixar lista/);
  });
  it("servidor aceita no máximo 10 contas por emissão", () => {
    expect(fn).toMatch(/userIds: z\.array\(z\.string\(\)\.uuid\(\)\)\.min\(1\)\.max\(10\)/);
  });
});
