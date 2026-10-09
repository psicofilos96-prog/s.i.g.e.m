import { describe, expect, it } from "vitest";
import { decideCode, generateCode, hashCode, normalizeCode, passwordIssue, MAX_ATTEMPTS } from "./activation-code";

const now = new Date("2026-10-09T12:00:00Z");
const row = async (o: Partial<{ expires_at: string; consumed_at: string | null; revoked_at: string | null; attempts: number }> = {}) => ({
  code_hash: await hashCode("ABCD-EFGH-JKLM"), expires_at: "2026-10-12T12:00:00Z", consumed_at: null, revoked_at: null, attempts: 0, ...o,
});

describe("código de acesso", () => {
  it("gera 12 caracteres sem 0/O/1/I", () => {
    const c = generateCode();
    expect(normalizeCode(c)).toHaveLength(12);
    expect(c).not.toMatch(/[01OI]/);
  });
  it("aceita código certo, com ou sem traço e minúsculas", async () => {
    expect(decideCode(await row(), await hashCode("abcdefghjklm"), now)).toBe("ok");
  });
  it("recusa código errado", async () => {
    expect(decideCode(await row(), await hashCode("ZZZZ-ZZZZ-ZZZZ"), now)).toBe("invalid");
  });
  it("recusa reutilização", async () => {
    expect(decideCode(await row({ consumed_at: "2026-10-09T11:00:00Z" }), await hashCode("ABCD-EFGH-JKLM"), now)).toBe("used");
  });
  it("recusa expirado", async () => {
    expect(decideCode(await row({ expires_at: "2026-10-09T11:59:59Z" }), await hashCode("ABCD-EFGH-JKLM"), now)).toBe("expired");
  });
  it("bloqueia após 5 tentativas", async () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(decideCode(await row({ attempts: 5 }), await hashCode("ABCD-EFGH-JKLM"), now)).toBe("locked");
  });
  it("login sem código é inválido", async () => {
    expect(decideCode(null, "x", now)).toBe("invalid");
  });
  it("senha: mínimo 8 e confirmação igual", () => {
    expect(passwordIssue("1234567", "1234567")).toMatch(/8/);
    expect(passwordIssue("frase longa", "frase longx")).toMatch(/iguais/);
    expect(passwordIssue("frase longa", "frase longa")).toBeNull();
  });
});
