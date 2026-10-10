/**
 * Cartão-resposta do SIA: UM motor de layout (mm, A4) usado para desenhar o cartão E para ler a imagem,
 * de modo que as coordenadas lidas são as mesmas desenhadas — nunca estimadas depois.
 * Leitura só propõe; gravar exige conferência humana (ver `confirmReading`).
 * Limite atual: lê imagem já retificada (escaneada/enquadrada pelos 4 marcadores); homografia
 * de foto inclinada ainda não implementada.
 */
export const PAGE = { w: 210, h: 297 } as const;
export const MARKER = 8; // quadrados pretos de canto, mm
export type Bubble = { question: number; option: string; cx: number; cy: number; r: number };
export type CardLayout = { questions: number; options: string[]; bubbles: Bubble[]; markers: { x: number; y: number; s: number }[] };

export function cardLayout(questions: number, optionCount: 4 | 5): CardLayout {
  const options = "ABCDE".slice(0, optionCount).split("");
  const perCol = 25, colW = 90, top = 70, left = 30, rowH = 8, r = 2.6;
  const bubbles: Bubble[] = [];
  for (let q = 1; q <= questions; q++) {
    const col = Math.floor((q - 1) / perCol), row = (q - 1) % perCol;
    options.forEach((o, k) => bubbles.push({ question: q, option: o, cx: left + col * colW + 14 + k * 9, cy: top + row * rowH, r }));
  }
  const m = 15;
  return { questions, options, bubbles, markers: [{ x: m, y: m, s: MARKER }, { x: PAGE.w - m - MARKER, y: m, s: MARKER }, { x: m, y: PAGE.h - m - MARKER, s: MARKER }, { x: PAGE.w - m - MARKER, y: PAGE.h - m - MARKER, s: MARKER }] };
}

/** Token opaco (sem PII): aleatório; a correspondência prova/versão/aluno fica só no servidor. */
export function opaqueToken(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(16))) {
  return "sia_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function cardSvg(l: CardLayout, header: { title: string; token: string }) {
  const b = l.bubbles.map((x) => `<circle cx="${x.cx}" cy="${x.cy}" r="${x.r}" fill="none" stroke="#000" stroke-width="0.3"/><text x="${x.cx}" y="${x.cy + 0.9}" font-size="2.4" text-anchor="middle">${x.option}</text>`).join("");
  const nums = Array.from({ length: l.questions }, (_, i) => { const f = l.bubbles.find((x) => x.question === i + 1)!; return `<text x="${f.cx - 8}" y="${f.cy + 1}" font-size="3">${i + 1}</text>`; }).join("");
  const mk = l.markers.map((m) => `<rect x="${m.x}" y="${m.y}" width="${m.s}" height="${m.s}" fill="#000"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><rect width="210" height="297" fill="#fff"/>${mk}<text x="30" y="35" font-size="5">${header.title}</text><text x="30" y="45" font-size="3">Código: ${header.token}</text><text x="30" y="55" font-size="3">Preencha totalmente a bolha. Use caneta azul ou preta.</text>${nums}${b}</svg>`;
}

/** Imagem cinza retificada ao tamanho da página (largura px ↔ 210mm). */
export type Gray = { width: number; height: number; data: Uint8ClampedArray | number[] };

function darkness(img: Gray, b: Bubble) {
  const s = img.width / PAGE.w, cx = b.cx * s, cy = b.cy * s, r = b.r * s * 0.7;
  let dark = 0, n = 0;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r || x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
    n++; if ((img.data[y * img.width + x] ?? 255) < 128) dark++;
  }
  return n ? dark / n : 0;
}

export type ReadState = "marcada" | "em-branco" | "multipla" | "ambigua";
export type QuestionRead = { question: number; state: ReadState; option: string | null; fill: Record<string, number> };

/** Classifica por fração escura: ≥ 0,45 marcada; 0,2–0,45 ambígua (vai para conferência). */
export function readCard(l: CardLayout, img: Gray, t = { filled: 0.45, faint: 0.2 }): QuestionRead[] {
  return Array.from({ length: l.questions }, (_, i) => {
    const q = i + 1, fill: Record<string, number> = {};
    for (const b of l.bubbles.filter((x) => x.question === q)) fill[b.option] = Math.round(darkness(img, b) * 100) / 100;
    const marked = Object.keys(fill).filter((o) => fill[o]! >= t.filled);
    const faint = Object.keys(fill).filter((o) => fill[o]! >= t.faint && fill[o]! < t.filled);
    const state: ReadState = faint.length ? "ambigua" : marked.length > 1 ? "multipla" : marked.length === 1 ? "marcada" : "em-branco";
    return { question: q, state, option: state === "marcada" ? marked[0]! : null, fill };
  });
}

/** Nada é gravado sem conferência: toda questão ambígua/múltipla precisa de decisão humana explícita. */
export function confirmReading(reads: readonly QuestionRead[], humanDecisions: Readonly<Record<number, string | null>>, confirmedByUser: boolean) {
  if (!confirmedByUser) return { ok: false as const, reason: "conferência humana obrigatória" };
  const open = reads.filter((r) => (r.state === "ambigua" || r.state === "multipla") && !(r.question in humanDecisions));
  if (open.length) return { ok: false as const, reason: `questões sem decisão: ${open.map((r) => r.question).join(", ")}` };
  return { ok: true as const, answers: Object.fromEntries(reads.map((r) => [r.question, r.question in humanDecisions ? humanDecisions[r.question]! : r.option])) as Record<number, string | null> };
}

/** Imagem sintética para testes: pinta bolhas escolhidas com intensidade dada. */
export function synthImage(l: CardLayout, pxPerMm: number, marks: Record<number, Record<string, number>>): Gray {
  const width = Math.round(PAGE.w * pxPerMm), height = Math.round(PAGE.h * pxPerMm), data = new Uint8ClampedArray(width * height).fill(255);
  for (const b of l.bubbles) {
    const k = marks[b.question]?.[b.option]; if (!k) continue;
    const cx = b.cx * pxPerMm, cy = b.cy * pxPerMm, r = b.r * pxPerMm;
    let i = 0;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { if ((i++ % 100) / 100 < k) data[y * width + x] = 20; }
  }
  return { width, height, data };
}
