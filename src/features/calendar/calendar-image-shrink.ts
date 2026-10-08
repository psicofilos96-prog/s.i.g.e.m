/**
 * Reduz automaticamente imagens grandes antes de gravar no perfil visual (limite do banco ≈1,5 MB
 * por imagem e 4 MB no total). Mantém transparência (WEBP) e a proporção; nunca recusa só por tamanho.
 */
export const SHRINK_TARGET_CHARS = 600_000;

const toDataUrl = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });

export async function shrinkImage(file: File, target = SHRINK_TARGET_CHARS): Promise<string> {
  const original = await toDataUrl(file);
  if (original.length <= target) return original;
  const bmp = await createImageBitmap(file);
  let maxSide = Math.min(2400, Math.max(bmp.width, bmp.height));
  for (let attempt = 0; attempt < 8; attempt++) {
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    for (const q of [0.85, 0.7, 0.55]) {
      const url = c.toDataURL("image/webp", q);
      if (url.startsWith("data:image/webp") && url.length <= target) return url;
      if (!url.startsWith("data:image/webp")) { const j = c.toDataURL("image/png"); if (j.length <= target) return j; }
    }
    maxSide = Math.round(maxSide * 0.75);
  }
  throw new Error("Não foi possível reduzir a imagem. Tente outra imagem.");
}
