// NAE.8 Lote 2 — evidências binárias: regras puras compartilhadas por servidor, prova e tela.
// Anexar não aceita entrega, não aprova NF, não paga e não movimenta estoque.

export const EVIDENCE_BUCKET = "alimentacao-evidencias";
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_MEDIA = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type EvidenceMedia = (typeof EVIDENCE_MEDIA)[number];
export type EvidenceTarget = "recebimento" | "nao-conformidade" | "documento-fiscal";

/** Tipo real pelos bytes iniciais; o MIME declarado pelo navegador não é confiável. */
export function sniffMedia(b: Uint8Array): EvidenceMedia | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

export function validateEvidence(bytes: Uint8Array, declared: string): { media: EvidenceMedia } | { error: string } {
  if (bytes.length === 0 || bytes.length > EVIDENCE_MAX_BYTES) return { error: "meal:evidence-size" };
  const media = sniffMedia(bytes);
  if (!media) return { error: "meal:evidence-media-type" };
  if (declared && declared !== media) return { error: "meal:evidence-media-mismatch" };
  return { media };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

export const EVIDENCE_EVENT_LABEL = { anexacao: "Anexado", substituicao: "Substituído", revogacao: "Revogado" } as const;

const MESSAGES: Record<string, string> = {
  "meal:evidence-size": "Arquivo vazio ou maior que 10 MB.",
  "meal:evidence-media-type": "Formato não aceito. Use JPEG, PNG, WebP ou PDF.",
  "meal:evidence-media-mismatch": "O conteúdo do arquivo não corresponde ao tipo informado.",
  "meal:evidence-not-available": "Evidência indisponível para você ou revogada.",
  "meal:evidence-target-unknown": "Registro de origem não encontrado.",
  "meal:evidence-revoked": "Esta evidência já foi revogada.",
  "meal:stale": "Outra pessoa alterou esta evidência. Recarregue.",
  "meal:reason-required": "Informe o motivo.",
  "meal:evidence-storage-failed": "Falha ao guardar o arquivo. Nada foi registrado.",
};
export function evidenceMessage(raw: string): string {
  if (raw.startsWith("capability:")) return "Você não tem permissão para esta evidência nesta escola.";
  const k = Object.keys(MESSAGES).find((m) => raw.includes(m));
  return k ? MESSAGES[k] : "Não foi possível concluir. Tente novamente.";
}
