import { describe, expect, it } from "vitest";
import { categorize, GOVERNED_CLASS } from "./governed-errors";

// NZEROERROR.1: leitura sem sessão (PostgREST 42501 "permission denied for function …")
// é autorização esperada, nunca "indisponível"/incidente nem "não foi possível registrar".
describe("leitura sem sessão", () => {
  const e = { code: "42501", message: "permission denied for function integration_overview" };
  it("categoria é autorização", () => expect(categorize(e)).toBe("autorizacao"));
  it("não é incidente", () => expect(GOVERNED_CLASS[categorize(e)]).toBe("expected.forbidden"));
});
