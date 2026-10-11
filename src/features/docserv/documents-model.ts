/** DocServ LOTE 02 — regras puras do envio de antecedentes. Validade legal só por política aprovada (não presumida). */
export type DocStatus = "pendente_validacao" | "valido" | "vencido" | "rejeitado" | "alerta_revisao_urgente" | "excluido";
export type DocRow = {
  document_id: string; version: number; version_id: string; person_id: string; masked_name: string | null; type: string; season: string;
  school_id: string | null; path: string; sha256: string; mime: string; size: number; issuer: string | null; issued_on: string | null;
  valid_until: string | null; submitted_at: string; submitted_by_me: boolean; seq: number; last_event: string; status: DocStatus; note: string | null;
};

export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export const MAX_BYTES = 10 * 1024 * 1024;

export const STATUS_LABEL: Record<DocStatus, string> = {
  pendente_validacao: "aguardando validação", valido: "válido", vencido: "vencido", rejeitado: "rejeitado",
  alerta_revisao_urgente: "revisão urgente", excluido: "excluído",
};

export function fileProblem(f: { type: string; size: number }): string | null {
  if (!(ALLOWED_MIME as readonly string[]).includes(f.type)) return "Envie PDF, JPG ou PNG.";
  if (f.size <= 0) return "Arquivo vazio.";
  if (f.size > MAX_BYTES) return "Arquivo acima de 10 MB.";
  return null;
}

/** Status de exibição: vencido é derivado da data, nunca gravado. */
export function displayStatus(stored: Exclude<DocStatus, "vencido" | "excluido">, validUntil: string | null, today: string, deleted = false): DocStatus {
  if (deleted) return "excluido";
  if (validUntil && validUntil < today) return "vencido";
  return stored;
}

export const reviewNeedsNote = (s: string) => s === "rejeitado" || s === "alerta_revisao_urgente";

export const storagePath = (person: string, document: string, fileName: string) =>
  `${person}/${document}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80)}`;

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
