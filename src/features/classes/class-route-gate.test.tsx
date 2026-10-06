import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// AT — apresentação: o convite de entrada e o carregamento sempre têm h1 e status acessível.
describe("ClassRouteGate — acessibilidade", () => {
  const src = readFileSync("src/features/classes/class-route-gate.tsx", "utf8");
  it("renderiza h1 (sr-only) nos ramos sem sessão e de carregamento", () => {
    expect(src.match(/<h1 className="sr-only">/g)?.length).toBe(2);
    expect(src).toContain('role="status"');
  });
  it("não decide acesso: só escolhe entre institucional e laboratório pela sessão", () => {
    expect(src).not.toMatch(/has_capability|capabilit/i);
  });
});
