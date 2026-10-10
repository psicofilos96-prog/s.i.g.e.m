import { describe, expect, it } from "vitest";
import { cardLayout, cardSvg, confirmReading, opaqueToken, readCard, synthImage } from "./answer-card";

const l = cardLayout(10, 5);

describe("cartão-resposta SIA", () => {
  it("bolhas circulares e 4 ou 5 alternativas", () => {
    expect(cardLayout(3, 4).bubbles).toHaveLength(12);
    expect(cardSvg(l, { title: "AV1", token: "sia_x" })).toContain("<circle");
  });
  it("token é opaco e sem PII", () => {
    const t = opaqueToken(new Uint8Array(16).fill(1));
    expect(t).toMatch(/^sia_[0-9a-f]{32}$/);
  });
  it("lê marcadas, em branco, múltiplas e ambíguas em imagem sintética", () => {
    const img = synthImage(l, 6, { 1: { A: 1 }, 2: { C: 1, D: 1 }, 3: { B: 0.3 } });
    const r = readCard(l, img);
    expect(r[0]).toMatchObject({ state: "marcada", option: "A" });
    expect(r[1]!.state).toBe("multipla");
    expect(r[2]!.state).toBe("ambigua");
    expect(r[3]).toMatchObject({ state: "em-branco", option: null });
  });
  it("em branco continua nulo, não vira erro", () => {
    const r = readCard(l, synthImage(l, 6, {}));
    expect(r.every((x) => x.option === null)).toBe(true);
  });
  it("sem conferência humana nada é aceito; ambígua exige decisão", () => {
    const r = readCard(l, synthImage(l, 6, { 3: { B: 0.3 } }));
    expect(confirmReading(r, {}, false).ok).toBe(false);
    expect(confirmReading(r, {}, true).ok).toBe(false);
    const ok = confirmReading(r, { 3: "B" }, true);
    expect(ok.ok && ok.answers[3]).toBe("B");
  });
});
