import { describe, expect, it } from "vitest";
import { readingValue } from "./home-today-model";

describe("painel 'Para você hoje'", () => {
  it("falha de leitura nunca vira zero", () => expect(readingValue({ state: "error" })).toBe("Não foi possível ler"));
  it("valor ausente é 'Não disponível', não zero", () => expect(readingValue({ state: "ok", value: null })).toBe("Não disponível"));
  it("zero só aparece quando lido", () => expect(readingValue({ state: "ok", value: 0 })).toBe("0"));
});
