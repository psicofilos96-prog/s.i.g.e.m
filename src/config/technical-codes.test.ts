import { describe, expect, it } from "vitest";
import { humanizeForScreen } from "./technical-codes";

describe("códigos técnicos nunca aparecem crus na tela", () => {
  it("prazo de não conformidade", () => {
    expect(humanizeForScreen("NONCONFORMITY_DEADLINE — BLOCKED_BY_HOMOLOGATED_RULE")).toBe("Defina o prazo para resolver não conformidades em Parâmetros");
  });
  it("adesão", () => {
    expect(humanizeForScreen("ADHESION_METRIC — BLOCKED_BY_HOMOLOGATED_RULE")).toBe("Defina como a adesão é calculada em Parâmetros");
  });
  it("código desconhecido vira frase genérica", () => {
    expect(humanizeForScreen("XYZ_ABC_PENDING")).not.toMatch(/_/);
  });
  it("texto comum passa intacto", () => {
    expect(humanizeForScreen("Escola iniciou e não submeteu.")).toBe("Escola iniciou e não submeteu.");
  });
  it("frase com código no meio", () => {
    expect(humanizeForScreen("STOCK_BASIS_POLICY — BLOCKED_BY_HOMOLOGATED_RULE. O sistema não escolhe.")).toBe("Defina qual saldo de estoque vale para o pedido em Parâmetros. O sistema não escolhe.");
  });
});
