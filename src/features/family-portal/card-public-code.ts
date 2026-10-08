/** Código do QR da carteirinha: "<publicId>.<versão>". Formato inválido ⇒ null (resposta igual a inexistente). */
export function parseCardCode(code: string): { publicId: string; version: number } | null {
  // NRATE.1: mesmo formato do banco (10 caracteres A-Z0-9); lixo nunca chega ao servidor.
  if (typeof code !== "string" || code.length > 32) return null;
  const m = /^([A-Za-z0-9]{10})\.(\d{1,4})$/.exec(code.trim());
  if (!m) return null;
  const version = Number(m[2]);
  return version >= 1 ? { publicId: m[1]!.toUpperCase(), version } : null;
}
export const cardCode = (publicId: string, version: number) => `${publicId}.${version}`;
export const cardVerifyPath = (publicId: string, version: number) => `/verificar/carteirinha/${cardCode(publicId, version)}`;

export const CARD_STATUS_LABEL = {
  valida: "Carteirinha válida", expirada: "Carteirinha expirada", cancelada: "Carteirinha cancelada",
  substituida: "Carteirinha substituída por uma nova emissão", indisponivel: "Carteirinha não encontrada",
} as const;
export type CardStatus = keyof typeof CARD_STATUS_LABEL;

export type PublicCardRow = { status: string | null; student_name: string | null; school_name: string | null; class_label: string | null; academic_year: string | null; public_id: string | null };
const EMPTY = { student_name: null, school_name: null, class_label: null, academic_year: null, public_id: null };
/** N9.2.5: status desconhecido (ou ausente) do servidor cai em "não encontrada" SEM detalhes, porque estado inesperado não pode revelar dado (NPUB.2). */
export function publicCardView(row: Partial<PublicCardRow> | null | undefined): { status: CardStatus } & Omit<PublicCardRow, "status"> {
  const s = row?.status;
  if (!row || typeof s !== "string" || !Object.prototype.hasOwnProperty.call(CARD_STATUS_LABEL, s) || s === "indisponivel") return { status: "indisponivel", ...EMPTY };
  return { status: s as CardStatus, student_name: row.student_name ?? null, school_name: row.school_name ?? null, class_label: row.class_label ?? null, academic_year: row.academic_year ?? null, public_id: row.public_id ?? null };
}
