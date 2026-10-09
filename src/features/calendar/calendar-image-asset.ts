/**
 * CAL.ASSET.1 — caminho único das imagens de personalização do calendário.
 * Arquitetura: imagem é incorporada no perfil visual como data URL PNG/JPEG/WEBP
 * (sem bucket), gravada em revisões append-only; portanto não há arquivo órfão e o
 * PDF histórico reproduz exatamente a imagem daquela revisão. Imagem nunca toca
 * conteúdo/homologação do calendário.
 */
import { validateImage } from "./calendar-external-sections";
import { ASSET_MAX_CHARS } from "./calendar-external-model";
import { shrinkImage } from "./calendar-image-shrink";

const SAFE_IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** Só data URL PNG/JPEG/WEBP dentro do limite do banco; o resto não é desenhado. */
export function safeImageSrc(v: unknown): string | null {
  return typeof v === "string" && v.length <= ASSET_MAX_CHARS && SAFE_IMG.test(v) ? v : null;
}

/** Confere assinatura real, reduz se preciso (PNG/WEBP preservam alfa) e devolve a data URL. */
export async function prepareImageFile(f: File | undefined): Promise<{ ok: string } | { error: string }> {
  if (!f) return { error: "Nenhum arquivo." };
  const v = validateImage(f.type, new Uint8Array(await f.arrayBuffer()), { ignoreSize: true });
  if ("error" in v) return v;
  try {
    const url = await shrinkImage(f);
    return safeImageSrc(url) ? { ok: url } : { error: "Não foi possível reduzir a imagem. Tente outra imagem." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Imagem inválida." };
  }
}
