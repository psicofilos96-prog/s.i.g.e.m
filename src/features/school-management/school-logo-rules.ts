export const LOGO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** Recusa local espelhando o banco: só imagem até 2 MB. */
export function logoProblem(f: { type: string; size: number }): string | null {
  if (!(LOGO_MIME as readonly string[]).includes(f.type)) return "Envie uma imagem JPG, PNG ou WEBP.";
  if (f.size <= 0 || f.size > LOGO_MAX_BYTES) return "A imagem deve ter até 2 MB.";
  return null;
}
