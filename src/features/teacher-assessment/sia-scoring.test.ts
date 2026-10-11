import { describe, expect, it } from "vitest";
import { cardLayout, readCard, synthImage, type Gray } from "./answer-card";
import { homography, rectify } from "./answer-card-rectify";
import { parseQr, qrPayload, readConfidence, scoreLines, scoreSummary } from "./sia-scoring";
import type { VariantMap } from "./variant-key";

const map: VariantMap = { instrumentVersionId: "v", variant: "A", entries: [
  { number: 1, itemVersionId: "i1", displayToKey: { A: "x", B: "y", C: "z", D: "w" }, keyToDisplay: { x: "A", y: "B", z: "C", w: "D" } },
  { number: 2, itemVersionId: "i2", displayToKey: { A: "x", B: "y", C: "z", D: "w" }, keyToDisplay: { x: "A", y: "B", z: "C", w: "D" } },
  { number: 3, itemVersionId: "i3", displayToKey: { A: "x", B: "y", C: "z", D: "w" }, keyToDisplay: { x: "A", y: "B", z: "C", w: "D" } },
  { number: 4, itemVersionId: "d4", displayToKey: {}, keyToDisplay: {} },
] };
const keys = new Map([["i1", "y"], ["i2", "x"], ["i3", "z"]]);
const objective = new Set(["i1", "i2", "i3"]);
const weights = new Map<string, number | null>([["i1", 2], ["i2", 2], ["i3", 2], ["d4", 4]]);

const l = cardLayout(4, 4);
function withMarkers(img: Gray, ppm: number) { for (const m of l.markers) for (let y = Math.round(m.y * ppm); y < (m.y + m.s) * ppm; y++) for (let x = Math.round(m.x * ppm); x < (m.x + m.s) * ppm; x++) img.data[y * img.width + x] = 0; return img; }
function warp(src: Gray, W: number, H: number, c: { x: number; y: number }[], noise: number) {
  const toSrc = homography(c, [{ x: 0, y: 0 }, { x: src.width, y: 0 }, { x: 0, y: src.height }, { x: src.width, y: src.height }]);
  const data = new Uint8ClampedArray(W * H).fill(235); let s = 7;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = toSrc({ x, y }), px = Math.round(p.x), py = Math.round(p.y); s = (s * 1103515245 + 12345) & 0x7fffffff;
    const n = ((s % 1000) / 1000 - 0.5) * noise; if (px >= 0 && py >= 0 && px < src.width && py < src.height) data[y * W + x] = Math.max(0, Math.min(255, src.data[py * src.width + px]! + n)); }
  return { width: W, height: H, data };
}

describe("SIA leitura e pontuação", () => {
  it("QR carrega só versão e letra", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(parseQr(qrPayload(id, "B"))).toEqual({ instrumentVersionId: id, letter: "B" });
    expect(parseQr(qrPayload(id, ""))).toEqual({ instrumentVersionId: id, letter: "" });
    expect(parseQr("sia_abc")).toBeNull();
  });
  it("foto deformada com ruído: leitura certa, rasura e dupla marcação vão à conferência", () => {
    const ppm = 4, base = withMarkers(synthImage(l, ppm, { 1: { B: 1 }, 2: { A: 1, C: 1 }, 3: { C: 1, D: 0.3 } }), ppm);
    const photo = warp(base, 900, 1250, [{ x: 70, y: 40 }, { x: 860, y: 95 }, { x: 25, y: 1200 }, { x: 880, y: 1150 }], 60);
    const r = rectify(l, photo); expect(r.ok).toBe(true); if (!r.ok) return;
    const reads = readCard(l, r.image);
    expect(reads[0]).toMatchObject({ state: "marcada", option: "B" }); expect(readConfidence(reads[0]!)).toBeGreaterThan(0.8);
    expect(reads[1]!.state).toBe("multipla"); expect(readConfidence(reads[1]!)).toBeLessThanOrEqual(0.5);
    expect(reads[2]!.state).toBe("ambigua");
    const lines = scoreLines(map, keys, reads, {}, objective);
    expect(lines.map((x) => x.status)).toEqual(["certa", null, null, null]);
    expect(scoreSummary(lines, weights).canSave).toBe(false);
    const done = scoreLines(map, keys, reads, { 2: { status: "anulada" }, 3: { option: "C" }, 4: { points: 3 } }, objective);
    const s = scoreSummary(done, weights);
    expect(s).toMatchObject({ score: 7, max: 8, canLaunch: true });
  });
  it("foto não lida nunca vira errada nem zero, e bloqueia o Diário", () => {
    const lines = scoreLines(map, keys, null, { 4: { points: 2 } }, objective);
    expect(lines.slice(0, 3).every((x) => x.status === "nao-lida")).toBe(true);
    const s = scoreSummary(lines, weights);
    expect(s.score).toBeNull(); expect(s.unread).toBe(3); expect(s.canSave).toBe(true); expect(s.canLaunch).toBe(false);
  });
  it("peso ausente impede nota; nota manual acima do peso é recusada", () => {
    const w = new Map(weights); w.set("i1", null);
    const lines = scoreLines(map, keys, null, { 1: { option: "B" }, 2: { option: "A" }, 3: { option: null }, 4: { points: 9 } }, objective);
    expect(lines[2]!.status).toBe("em-branco");
    expect(scoreSummary(lines, weights).badPoints).toBe(true);
    const ok = scoreLines(map, keys, null, { 1: { option: "B" }, 2: { option: "A" }, 3: { option: null }, 4: { points: 1 } }, objective);
    expect(scoreSummary(ok, w)).toMatchObject({ score: null, weightsMissing: true, canLaunch: false });
    expect(scoreSummary(ok, weights)).toMatchObject({ score: 5, max: 10 });
  });
});
