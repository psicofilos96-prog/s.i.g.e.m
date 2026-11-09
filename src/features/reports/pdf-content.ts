export type PdfAlignment = "left" | "center" | "right" | "justify";
export type PdfRun = { text: string; bold?: boolean; italic?: boolean };
export type PdfParagraph = { alignment: PdfAlignment; runs: readonly PdfRun[] };
export type PdfSection = { title: string; paragraphs: readonly PdfParagraph[] };
export type PdfAttachment = { dataUrl: string; width: number; height: number; caption: string };

/** Splits by measured glyphs, preserving emphasis even for words wider than a page. */
export function wrapPdfRuns(runs: readonly PdfRun[], maxWidth: number, measure: (run: PdfRun) => number): PdfRun[][] {
  const lines: PdfRun[][] = [];
  let line: PdfRun[] = [], width = 0;
  const flush = () => { if (line.length) lines.push(line); line = []; width = 0; };
  for (const run of runs) {
    for (const token of run.text.split(/(\s+)/).filter(Boolean)) {
      const word = { ...run, text: token };
      const size = measure(word);
      if (width + size > maxWidth && line.length) flush();
      if (!line.length && /^\s+$/.test(token)) continue;
      if (size <= maxWidth) { line.push(word); width += size; continue; }
      for (const char of token) {
        const piece = { ...run, text: char }, cw = measure(piece);
        if (width + cw > maxWidth && line.length) flush();
        line.push(piece); width += cw;
      }
    }
  }
  flush();
  return lines;
}

export function fitPdfImage(width: number, height: number, maxWidth: number, maxHeight: number) {
  if (![width, height, maxWidth, maxHeight].every((n) => Number.isFinite(n) && n > 0)) throw new Error("Não foi possível preparar a imagem para impressão.");
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}