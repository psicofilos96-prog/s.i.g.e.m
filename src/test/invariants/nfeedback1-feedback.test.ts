import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rg = (p: string) => execSync(`rg -nP '${p}' --glob '*.tsx' --glob '!*.test.*' src/features src/routes src/components || true`).toString().trim();

describe("NFEEDBACK.1 — retorno após ações", () => {
  it("mensagem condicional de resultado/erro é anunciada a leitores de tela", () => {
    expect(rg(String.raw`\{(err|error|notice|status|feedback|message|msg)\w* && <(p|div|span)(?![^>]*role=)[^>]*>`)).toBe("");
  });
  it("erro cru de exceção nunca vai direto para a tela", () => {
    expect(rg(String.raw`set(Msg|Err|Error)\(\(e as Error\)\.message\)`)).toBe("");
  });
  it("avisos flutuantes ficam tempo suficiente para leitura e podem ser fechados", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).toMatch(/<Toaster[^>]*closeButton[^>]*duration=\{8000\}/);
  });
});
