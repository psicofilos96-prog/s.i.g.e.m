/**
 * NCARD.1 — enquadramento 3×4 da foto (puro). zoom ≥ 1; deslocamentos em -1..1 movem a janela dentro da imagem.
 * Nunca estica: a janela 3:4 sempre cabe inteira na imagem de origem.
 */
export const PHOTO_OUT = { w: 600, h: 800 } as const;

export type Crop = { zoom: number; dx: number; dy: number };
export function cropRect(imgW: number, imgH: number, c: Crop): { sx: number; sy: number; sw: number; sh: number } {
  if (!(imgW > 0) || !(imgH > 0)) throw new Error("photo:empty");
  const zoom = Math.min(4, Math.max(1, c.zoom));
  // maior janela 3:4 que cabe na imagem
  let bw = imgW, bh = (imgW * 4) / 3;
  if (bh > imgH) { bh = imgH; bw = (imgH * 3) / 4; }
  const sw = bw / zoom, sh = bh / zoom;
  const clamp = (v: number) => Math.min(1, Math.max(-1, v));
  const sx = (imgW - sw) / 2 + clamp(c.dx) * ((imgW - sw) / 2);
  const sy = (imgH - sh) / 2 + clamp(c.dy) * ((imgH - sh) / 2);
  return { sx, sy, sw, sh };
}

/** Mensagem da câmera em linguagem do usuário; permissão negada oferece envio de arquivo. */
export function cameraErrorMessage(name: string): string {
  if (name === "NotAllowedError" || name === "SecurityError") return "O acesso à câmera foi negado. Libere a câmera nas configurações do navegador ou envie uma foto do aparelho.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Nenhuma câmera foi encontrada neste aparelho. Envie uma foto do aparelho.";
  if (name === "NotReadableError") return "A câmera está em uso por outro programa. Feche-o ou envie uma foto do aparelho.";
  if (name === "unsupported") return "Este navegador não permite usar a câmera aqui. Envie uma foto do aparelho.";
  return "Não foi possível abrir a câmera. Envie uma foto do aparelho.";
}
