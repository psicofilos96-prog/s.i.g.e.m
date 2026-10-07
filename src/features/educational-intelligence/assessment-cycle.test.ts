import { describe, expect, it } from "vitest";
import { currentCycleState, expectedHead, nextCycleState } from "./assessment-cycle";

const ev = (seq: number, to: string) => ({ seq, from_state: null, to_state: to, note: null, recorded_at: "2026-10-07T00:00:00Z" });

describe("ciclo da avaliação", () => {
  it("sem evento não há estado presumido", () => expect(currentCycleState([])).toBeNull());
  it("primeiro passo é planejada", () => expect(nextCycleState(null)).toBe("planejada"));
  it("validação vem antes e separada da publicação", () => {
    expect(nextCycleState("recebida")).toBe("validada");
    expect(nextCycleState("validada")).toBe("publicada");
  });
  it("arquivada é terminal", () => expect(nextCycleState("arquivada")).toBeNull());
  it("estado vigente e base esperada vêm do último seq", () => {
    const e = [ev(2, "preparada"), ev(1, "planejada")];
    expect(currentCycleState(e)).toBe("preparada");
    expect(expectedHead(e)).toBe(2);
  });
});
