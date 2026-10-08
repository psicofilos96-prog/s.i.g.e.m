/** NRATE.1: formato público do código de verificação de documento (igual ao banco: 16 hex). Fora dele não há chamada ao servidor. */
export function isDocumentCodeFormat(code: unknown): boolean {
  return typeof code === "string" && code.length <= 32 && /^[0-9A-Fa-f]{16}$/.test(code.trim());
}
