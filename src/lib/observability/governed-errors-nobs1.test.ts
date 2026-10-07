import { describe, expect, it } from "vitest";
import { governError, userErrorText } from "./governed-errors";

describe("NOBS.1 — categorias de recuperação", () => {
  it("token expirado = sessão expirada, não acesso negado", () => {
    expect(governError(new Error("JWT expired")).category).toBe("sessao-expirada");
  });
  it("falha de rede = sem conexão", () => {
    expect(governError(new TypeError("Failed to fetch")).category).toBe("sem-conexao");
  });
  it("permissão negada continua autorização", () => {
    expect(governError(new Error("permission denied for table x")).category).toBe("autorizacao");
  });
  it("texto da tela nunca carrega SQL cru", () => {
    const t = userErrorText(new Error('duplicate key value violates unique constraint "x_pkey"'));
    expect(t).not.toMatch(/constraint|x_pkey|duplicate key/);
    expect(t).toMatch(/Código: op-[0-9a-f]{12}\./);
  });
});
