import { describe, expect, it } from "vitest";
import { isRedirect } from "@tanstack/react-router";
import { Route } from "@/routes/transferencias";

const beforeLoad = Route.options.beforeLoad as (context: { location: { pathname: string } }) => void;

describe("entrada de transferências", () => {
  it.each(["/transferencias", "/transferencias/"])("%s abre o fluxo oficial", (pathname) => {
    let thrown: unknown;
    try { beforeLoad({ location: { pathname } }); } catch (error) { thrown = error; }
    expect(isRedirect(thrown)).toBe(true);
    if (!isRedirect(thrown)) throw new Error("Redirecionamento ausente");
    expect(thrown.options.to).toBe("/transferencias/nova");
    expect(thrown.options.replace).toBe(true);
  });

  it("a rota filha pode abrir sem um ciclo de redirecionamento", () => {
    expect(beforeLoad({ location: { pathname: "/transferencias/nova" } })).toBeUndefined();
  });
});
