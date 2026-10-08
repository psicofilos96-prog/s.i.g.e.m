import { describe, it, expect } from "vitest";
import { isAccountSwitch, reactToSignOut } from "./session-lifecycle";
const pub = (p: string) => p === "/" || p.startsWith("/conferir");
describe("NAUTH.3", () => {
  it("outra conta na mesma aba descarta o cache", () => expect(isAccountSwitch("a", "b")).toBe(true));
  it("mesma conta (refresh) não descarta", () => expect(isAccountSwitch("a", "a")).toBe(false));
  it("primeira entrada não é troca", () => expect(isAccountSwitch(null, "a")).toBe(false));
  it("expiração em deep link volta ao mesmo endereço", () => {
    const r = reactToSignOut("/turmas/123?aba=x", false, pub);
    expect(r.goTo?.search).toMatchObject({ motivo: "expirada" });
    expect(r.clearCache).toBe(true);
  });
  it("saída voluntária não oferece retorno", () => expect(reactToSignOut("/turmas", true, pub).goTo).toEqual({ to: "/auth", search: {} }));
  it("página pública não redireciona", () => expect(reactToSignOut("/", false, pub).goTo).toBeNull());
});
