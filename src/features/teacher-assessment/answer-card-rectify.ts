/**
 * Retificação de foto do cartão-resposta: localiza os 4 marcadores de canto e aplica homografia
 * para levar a foto ao sistema de coordenadas do layout (mm → px). Sem 4 marcadores confiáveis,
 * falha fechada: nunca lê bolhas de foto não enquadrada.
 */
import { PAGE, type CardLayout, type Gray } from "./answer-card";

export type Pt = { x: number; y: number };

/** Componentes escuros conexos; devolve centróide, área e caixa. */
function blobs(img: Gray, thr = 100) {
  const { width: w, height: h, data } = img, seen = new Uint8Array(w * h), out: { cx: number; cy: number; area: number; bw: number; bh: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || (data[i] ?? 255) >= thr) continue;
    let area = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    stack.push(i); seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!, x = p % w, y = (p - x) / w;
      area++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || seen[q] || (data[q] ?? 255) >= thr) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === w - 1)) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    out.push({ cx: sx / area, cy: sy / area, area, bw: x1 - x0 + 1, bh: y1 - y0 + 1 });
  }
  return out;
}

/** Marcadores: blobs quase quadrados e cheios, os maiores de cada quadrante da imagem. */
export function findMarkers(img: Gray): { ok: true; corners: [Pt, Pt, Pt, Pt] } | { ok: false; reason: string } {
  const minArea = (img.width * img.height) / 20000;
  const cands = blobs(img).filter((b) => b.area >= minArea && b.bw / b.bh > 0.6 && b.bw / b.bh < 1.6 && b.area / (b.bw * b.bh) > 0.6);
  const mx = img.width / 2, my = img.height / 2;
  const pick = (f: (b: (typeof cands)[number]) => boolean) => cands.filter(f).sort((a, b) => b.area - a.area)[0];
  const tl = pick((b) => b.cx < mx && b.cy < my), tr = pick((b) => b.cx >= mx && b.cy < my), bl = pick((b) => b.cx < mx && b.cy >= my), br = pick((b) => b.cx >= mx && b.cy >= my);
  if (!tl || !tr || !bl || !br) return { ok: false, reason: "os quatro quadrados pretos dos cantos não foram encontrados" };
  const areas = [tl, tr, bl, br].map((b) => b.area), ratio = Math.max(...areas) / Math.min(...areas);
  if (ratio > 6) return { ok: false, reason: "marcadores com tamanhos muito diferentes — foto muito inclinada ou cortada" };
  return { ok: true, corners: [tl, tr, bl, br].map((b) => ({ x: b.cx, y: b.cy })) as [Pt, Pt, Pt, Pt] };
}

/** Resolve sistema 8×8 (Gauss com pivô). */
function solve(A: number[][], b: number[]) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    [M[c], M[p]] = [M[p]!, M[c]!];
    if (Math.abs(M[c]![c]!) < 1e-12) throw new Error("homografia degenerada");
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r]![c]! / M[c]![c]!; for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!; }
  }
  return M.map((r, i) => r[n]! / r[i]!);
}

/** H tal que H·src = dst (4 pares). */
export function homography(src: Pt[], dst: Pt[]) {
  const A: number[][] = [], b: number[] = [];
  src.forEach((s, i) => { const d = dst[i]!;
    A.push([s.x, s.y, 1, 0, 0, 0, -s.x * d.x, -s.y * d.x]); b.push(d.x);
    A.push([0, 0, 0, s.x, s.y, 1, -s.x * d.y, -s.y * d.y]); b.push(d.y); });
  const h = solve(A, b);
  return (p: Pt): Pt => { const w = h[6]! * p.x + h[7]! * p.y + 1; return { x: (h[0]! * p.x + h[1]! * p.y + h[2]!) / w, y: (h[3]! * p.x + h[4]! * p.y + h[5]!) / w }; };
}

/** Leva a foto ao quadro do layout (largura `outW` px ↔ 210 mm). */
export function rectify(l: CardLayout, photo: Gray, outW = 1050) {
  const f = findMarkers(photo); if (!f.ok) return f;
  const s = outW / PAGE.w, outH = Math.round(PAGE.h * s);
  const centers = l.markers.map((m) => ({ x: (m.x + m.s / 2) * s, y: (m.y + m.s / 2) * s }));
  const map = homography(centers, f.corners); // destino retificado → foto
  const data = new Uint8ClampedArray(outW * outH);
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    const p = map({ x, y }), px = Math.round(p.x), py = Math.round(p.y);
    data[y * outW + x] = px < 0 || py < 0 || px >= photo.width || py >= photo.height ? 255 : (photo.data[py * photo.width + px] ?? 255);
  }
  return { ok: true as const, image: { width: outW, height: outH, data } as Gray, corners: f.corners };
}
