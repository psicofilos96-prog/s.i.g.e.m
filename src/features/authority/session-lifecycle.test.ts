import { describe, expect, it } from "vitest";
import { consumeVoluntarySignOut, markVoluntarySignOut, postLoginTarget, reactToSignOut, safeRedirect } from "./session-lifecycle";

const pub = (p: string) => p.startsWith("/publico");

describe("NAUTH.2 ciclo de sessão", () => {
  it("retorno só para caminho interno", () => {
    expect(safeRedirect("/turmas/abc?aba=1")).toBe("/turmas/abc?aba=1");
    for (const bad of ["https://x.com", "//x.com", "/\\x.com", "javascript:1", "/auth", "/login?a", "", 5, null])
      expect(safeRedirect(bad)).toBeNull();
  });
  it("sessão expirada leva ao login com retorno e motivo", () => {
    expect(reactToSignOut("/turmas/abc", false, pub)).toEqual({ clearCache: true, goTo: { to: "/auth", search: { redirect: "/turmas/abc", motivo: "expirada" } } });
  });
  it("saída voluntária não oferece retorno à tela anterior", () => {
    expect(reactToSignOut("/turmas/abc", true, pub).goTo).toEqual({ to: "/auth", search: {} });
  });
  it("rota pública não redireciona, mas o cache é sempre limpo", () => {
    expect(reactToSignOut("/publico/x", false, pub)).toEqual({ clearCache: true, goTo: null });
  });
  it("marca voluntária é consumida uma vez", () => {
    markVoluntarySignOut();
    expect(consumeVoluntarySignOut()).toBe(true);
    expect(consumeVoluntarySignOut()).toBe(false);
  });
});


describe("destino após autenticação", () => {
  it.each([undefined, null, "", "https://externo.example", "//externo.example", "/auth"])("sem deep link interno seguro, %s abre a área inicial", (value) => {
    expect(postLoginTarget(value)).toBe("/");
  });
  it("mantém o caminho interno solicitado e sua busca", () => {
    expect(postLoginTarget("/secretaria?aba=matriculas")).toBe("/secretaria?aba=matriculas");
    expect(postLoginTarget("/diario/turmas")).toBe("/diario/turmas");
  });
});
