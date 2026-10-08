import { describe, expect, it } from "vitest";
import { classifyLoginError, loginMessage } from "./login-messages";

describe("NLOGIN.2 mensagens do login", () => {
  it("login inexistente e senha errada têm a mesma mensagem", () => {
    expect(classifyLoginError({ status: 400, message: "Invalid login credentials" })).toBe("credentials");
    expect(classifyLoginError({ status: 400, message: "User not found" })).toBe("credentials");
  });
  it("excesso de tentativas, rede e servidor são distinguidos", () => {
    expect(classifyLoginError({ status: 429 })).toBe("rate-limit");
    expect(classifyLoginError({ status: 0, message: "Failed to fetch" })).toBe("network");
    expect(classifyLoginError({ status: 503 })).toBe("unavailable");
  });
  it("mensagem nunca traz texto técnico", () => {
    for (const k of ["empty", "credentials", "rate-limit", "network", "unavailable"] as const) expect(loginMessage(k)).not.toMatch(/invalid|error|fetch|\d{3}/i);
  });
});
