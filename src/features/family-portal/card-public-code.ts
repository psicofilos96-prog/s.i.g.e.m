/** Código do QR da carteirinha: "<publicId>.<versão>". Formato inválido ⇒ null (resposta igual a inexistente). */
export function parseCardCode(code: string): { publicId: string; version: number } | null {
  const m = /^([A-Za-z0-9-]{4,64})\.(\d{1,4})$/.exec(code.trim());
  if (!m) return null;
  const version = Number(m[2]);
  return version >= 1 ? { publicId: m[1]!, version } : null;
}
export const cardCode = (publicId: string, version: number) => `${publicId}.${version}`;
export const cardVerifyPath = (publicId: string, version: number) => `/verificar/carteirinha/${cardCode(publicId, version)}`;

export const CARD_STATUS_LABEL = {
  valida: "Carteirinha válida", expirada: "Carteirinha expirada", cancelada: "Carteirinha cancelada",
  substituida: "Carteirinha substituída por uma nova emissão", indisponivel: "Carteirinha não encontrada",
} as const;
export type CardStatus = keyof typeof CARD_STATUS_LABEL;
