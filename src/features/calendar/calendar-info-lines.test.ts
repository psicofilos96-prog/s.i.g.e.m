import { describe, expect, it } from "vitest";
import { parseInfoLine, serializeInfoLine } from "./calendar-info-lines";

describe("informações adicionais: lugar e formatação", () => {
  it("linha antiga sem marcação continua abaixo dos Conselhos, sem formatação", () => {
    expect(parseInfoLine("Reunião de pais")).toEqual({ text: "Reunião de pais", place: "depois-conselhos", bold: false, italic: false });
  });
  it("negrito, itálico e lugar sobrevivem a salvar e reabrir", () => {
    const l = { text: "Dia do Professor", place: "depois-periodos" as const, bold: true, italic: true };
    expect(parseInfoLine(serializeInfoLine(l))).toEqual(l);
  });
  it("lugar desconhecido não some: vira texto abaixo dos Conselhos", () => {
    expect(parseInfoLine("@outro|x").place).toBe("depois-conselhos");
  });
});
