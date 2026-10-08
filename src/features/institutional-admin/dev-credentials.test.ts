import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { devToolGate, generateTemporaryPassword } from "./dev-credentials";
import { passwordProblem } from "./access-inventory";

describe("NACCESS.3 — ferramenta de senhas temporárias", () => {
  it("fica desligada sem o interruptor do servidor, mesmo na pré-visualização", () => {
    expect(devToolGate("https://id-preview--abc.lovable.app/central-de-acessos", undefined).enabled).toBe(false);
    expect(devToolGate("http://localhost:8080/", "true").enabled).toBe(false);
  });
  it("fica desligada no site publicado e em domínio próprio, mesmo com o interruptor", () => {
    expect(devToolGate("https://sigem.lovable.app/", "enabled").enabled).toBe(false);
    expect(devToolGate("https://sigem.itap.gov.br/", "enabled").enabled).toBe(false);
    expect(devToolGate("https://id-preview--abc.lovable.app.evil.com/", "enabled").enabled).toBe(false);
    expect(devToolGate("", "enabled").enabled).toBe(false);
  });
  it("liga só com interruptor + endereço de desenvolvimento", () => {
    expect(devToolGate("https://id-preview--a5d0ed94.lovable.app/x", "enabled").enabled).toBe(true);
    expect(devToolGate("http://localhost:8080/", "enabled").enabled).toBe(true);
  });
  it("cada senha é forte e diferente (valores nunca impressos)", () => {
    const all = Array.from({ length: 300 }, () => generateTemporaryPassword());
    expect(new Set(all).size).toBe(300);
    expect(all.every((p) => p.length === 16 && passwordProblem(p, p) === null)).toBe(true);
  });
  it("o servidor não registra nem grava a senha", () => {
    const src = readFileSync("src/features/institutional-admin/dev-credentials.functions.ts", "utf8");
    expect(src).not.toMatch(/console\.|telemetry|logEvent/);
    expect(src).not.toMatch(/\.from\(/);
  });
});
