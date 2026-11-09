import { describe, expect, it } from "vitest";
import { fitPdfImage, wrapPdfRuns } from "./pdf-content";
describe("conteúdo imprimível", () => {
  it("mantém proporção de fotos horizontais e verticais dentro da página", () => {
    expect(fitPdfImage(1200, 600, 180, 200)).toEqual({ width: 180, height: 90 });
    expect(fitPdfImage(600, 1200, 180, 200)).toEqual({ width: 100, height: 200 });
    expect(() => fitPdfImage(0, 10, 100, 100)).toThrow();
  });
  it("quebra palavras grandes sem perder conteúdo ou ênfase", () => {
    const lines = wrapPdfRuns([{ text: "abcdefghijkl", bold: true }], 5, (r) => r.text.length);
    expect(lines.map((line) => line.map((r) => r.text).join(""))).toEqual(["abcde", "fghij", "kl"]);
    expect(lines.flat().every((r) => r.bold)).toBe(true);
  });
});