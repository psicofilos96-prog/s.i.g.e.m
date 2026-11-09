import { describe, expect, it } from "vitest";
import { formattedTextValue, stripTextFormat } from "./text-format";
import { parseTextParagraphs } from "./text-format-model";

describe("formatação dos campos livres do acompanhamento", () => {
  for (const alignment of ["center", "right", "justify"] as const) {
    it(`persiste alinhamento ${alignment} e conserva ênfase`, () => {
      const result = formattedTextValue("**Escola**\nOutra", 2, 2, alignment);
      expect(result.value).toBe(`[align=${alignment}] **Escola**\nOutra`);
      expect(parseTextParagraphs(result.value)[0]).toEqual({ alignment, runs: [{ text: "Escola", bold: true }] });
      expect(stripTextFormat(result.value)).toBe("Escola\nOutra");
    });
  }
  it("retorna à esquerda sem duplicar marcadores nem mudar outro parágrafo", () => {
    const text = "[align=center] Um\n[align=right] Dois";
    expect(formattedTextValue(text, 0, 0, "left").value).toBe("Um\n[align=right] Dois");
    expect(formattedTextValue(text, 0, text.length, "justify").value).toBe("[align=justify] Um\n[align=justify] Dois");
  });
  it("preserva lista dentro do parágrafo alinhado", () => {
    const result = formattedTextValue("[align=center] Item", 19, 19, "bullet");
    expect(result.value).toBe("[align=center] • Item");
    expect(stripTextFormat(result.value)).toBe("• Item");
  });
  it("envolve a seleção com marcador de negrito", () => {
    const r = formattedTextValue("escola boa", 0, 6, "bold");
    expect(r.value).toBe("**escola** boa");
  });

  it("envolve a seleção com marcador de itálico", () => {
    const r = formattedTextValue("escola boa", 7, 10, "italic");
    expect(r.value).toBe("escola *boa*");
  });

  it("insere marcador com texto provisório quando não há seleção", () => {
    const r = formattedTextValue("", 0, 0, "bold");
    expect(r.value).toBe("**texto**");
  });

  it("marca a linha atual como item de lista e desfaz na segunda aplicação", () => {
    const once = formattedTextValue("primeira linha\nsegunda linha", 15, 15, "bullet");
    expect(once.value).toBe("primeira linha\n• segunda linha");
    const twice = formattedTextValue(once.value, 15 + 2, 15 + 2, "bullet");
    expect(twice.value).toBe("primeira linha\nsegunda linha");
  });

  it("remove os marcadores de ênfase nas exportações, preservando o conteúdo", () => {
    expect(stripTextFormat("**Diagnóstico** com *ênfase* e • item")).toBe("Diagnóstico com ênfase e • item");
  });

  it("não altera texto sem marcadores", () => {
    expect(stripTextFormat("texto simples")).toBe("texto simples");
  });
});
