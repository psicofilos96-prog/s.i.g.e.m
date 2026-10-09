import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { activationLink, generateLinkToken, hashCode } from "./activation-code";

describe("primeiro acesso por link individual", () => {
  it("o convite tem 32 símbolos aleatórios e cada link é diferente", () => {
    const a = generateLinkToken(), b = generateLinkToken();
    expect(a).toHaveLength(32); expect(a).not.toBe(b);
  });
  it("o link aponta para /primeiro-acesso com o convite e só o hash é comparado", async () => {
    expect(activationLink("https://x.app/", "ABC")).toBe("https://x.app/primeiro-acesso?convite=ABC");
    expect(await hashCode("ABC")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("a tela não pede login nem código", () => {
    const src = readFileSync("src/routes/primeiro-acesso.tsx", "utf8");
    expect(src).not.toMatch(/id="login"|id="codigo"|one-time-code/);
  });
  it("a redefinição com senha única para várias contas segue desativada", () => {
    expect(readFileSync("src/features/institutional-admin/access-reset.functions.ts", "utf8")).not.toMatch(/updateUserById/);
  });
});
