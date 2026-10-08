import { describe, expect, it } from "vitest";
import { isDocumentCodeFormat } from "./public-codes";
import { parseCardCode, CARD_STATUS_LABEL } from "@/features/family-portal/card-public-code";

describe("NRATE.1 — códigos públicos", () => {
  it("documento: só 16 hex", () => {
    expect(isDocumentCodeFormat("0123456789ABCDEF")).toBe(true);
    expect(isDocumentCodeFormat("0123456789abcdef")).toBe(true);
    for (const bad of ["", "123", "0123456789ABCDEG", "0123456789ABCDEF0", "' OR 1=1 --", "x".repeat(5000)]) expect(isDocumentCodeFormat(bad)).toBe(false);
  });
  it("carteirinha: 10 A-Z0-9 + versão ≥1, normalizada em maiúsculas", () => {
    expect(parseCardCode("abcde12345.2")).toEqual({ publicId: "ABCDE12345", version: 2 });
    for (const bad of ["ABCDE12345.0", "ABCD-12345.1", "ABC.1", "ABCDE123456.1", "ABCDE12345.12345", "a".repeat(5000)]) expect(parseCardCode(bad)).toBeNull();
  });
  it("rajada de 10.000 códigos aleatórios: nenhum lixo passa ao servidor", () => {
    let passed = 0;
    for (let i = 0; i < 10_000; i++) { const s = Math.random().toString(36).slice(2) + "!"; if (isDocumentCodeFormat(s) || parseCardCode(s)) passed++; }
    expect(passed).toBe(0);
  });
  it("inexistente e inválido têm o mesmo texto na carteirinha", () => {
    expect(CARD_STATUS_LABEL.indisponivel).toBe("Carteirinha não encontrada");
  });
});
