import { describe, expect, it } from "vitest";
import { PAGE, cardLayout, readCard, synthImage, type Gray } from "./answer-card";
import { findMarkers, homography, rectify } from "./answer-card-rectify";

const l = cardLayout(10, 5);
function withMarkers(img: Gray, ppm: number) {
  for (const m of l.markers) for (let y = Math.round(m.y * ppm); y < (m.y + m.s) * ppm; y++) for (let x = Math.round(m.x * ppm); x < (m.x + m.s) * ppm; x++) img.data[y * img.width + x] = 0;
  return img;
}
/** Simula foto: perspectiva + margem branca. */
function warp(src: Gray, W: number, H: number, corners: { x: number; y: number }[]) {
  const toSrc = homography(corners, [{ x: 0, y: 0 }, { x: src.width, y: 0 }, { x: 0, y: src.height }, { x: src.width, y: src.height }]);
  const data = new Uint8ClampedArray(W * H).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = toSrc({ x, y }), px = Math.round(p.x), py = Math.round(p.y);
    if (px >= 0 && py >= 0 && px < src.width && py < src.height) data[y * W + x] = src.data[py * src.width + px]!; }
  return { width: W, height: H, data };
}

describe("retificação do cartão (OMR sintético)", () => {
  const ppm = 4, base = withMarkers(synthImage(l, ppm, { 1: { B: 1 }, 2: { D: 1 }, 3: { A: 1, C: 1 }, 4: { E: 0.3 } }), ppm);
  it("foto inclinada em perspectiva volta ao layout e lê as mesmas bolhas", () => {
    const photo = warp(base, 1000, 1300, [{ x: 90, y: 60 }, { x: 900, y: 110 }, { x: 40, y: 1220 }, { x: 960, y: 1180 }]);
    const r = rectify(l, photo); expect(r.ok).toBe(true); if (!r.ok) return;
    const reads = readCard(l, r.image);
    expect(reads[0]).toMatchObject({ state: "marcada", option: "B" });
    expect(reads[1]).toMatchObject({ state: "marcada", option: "D" });
    expect(reads[2]!.state).toBe("multipla");
    expect(reads[3]!.state).toBe("ambigua");
    expect(reads[4]!.state).toBe("em-branco");
  });
  it("sem marcadores, falha fechada (não lê bolhas)", () => {
    const blank = synthImage(l, 2, { 1: { A: 1 } });
    expect(findMarkers(blank).ok).toBe(false);
    expect(rectify(l, blank).ok).toBe(false);
  });
  it("homografia identidade preserva pontos", () => {
    const q = [{ x: 0, y: 0 }, { x: PAGE.w, y: 0 }, { x: 0, y: PAGE.h }, { x: PAGE.w, y: PAGE.h }];
    expect(homography(q, q)({ x: 50, y: 70 }).x).toBeCloseTo(50);
  });
});
