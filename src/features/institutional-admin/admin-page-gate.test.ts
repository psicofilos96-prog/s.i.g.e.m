import { describe, expect, it } from "vitest";
import { adminPageAllowed } from "./institutional-admin-page";

describe("PERF.LOADING.1 — portão da Administração institucional", () => {
  it("professor sem capacidade administrativa não abre após a ativação", () => {
    expect(adminPageAllowed(["registrar-chamada"], true)).toBe(false);
  });
  it("capacidade administrativa abre", () => {
    expect(adminPageAllowed(["manter-contas-institucionais"], true)).toBe(true);
  });
  it("antes da ativação a tela segue aberta para a ativação inicial", () => {
    expect(adminPageAllowed([], false)).toBe(true);
  });
  it("estado desconhecido não decide", () => {
    expect(adminPageAllowed([], null)).toBeNull();
  });
});
