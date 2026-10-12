// Matrículas L09 — documentos digitais do pedido (migration 0461, bucket privado `enr-documentos`).
// Envio: código+conferência → vaga de envio com caminho único (30 min) → upload só nesse caminho → conferência pela equipe.
// Pendência documental NUNCA bloqueia o pedido nem o direito à educação: só sinaliza complementação.
import { supabase } from "@/integrations/supabase/client";

export const DOC_TYPES = {
  "identificacao-estudante": "Documento de identificação do estudante",
  "identificacao-responsavel": "Documento de identificação de quem pede",
  "comprovante-residencia": "Comprovante de residência",
  "historico-escolar": "Histórico escolar",
  "declaracao-escolar": "Declaração escolar",
  outro: "Outro documento",
} as const;
export type DocType = keyof typeof DOC_TYPES;
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export const MAX_BYTES = 10 * 1024 * 1024;

export type DocSituation = "nao-enviado" | "em-conferencia" | "conferido" | "complementacao-solicitada" | "recusado";
export const SITUATION_TEXT: Record<DocSituation, string> = {
  "nao-enviado": "Ainda não enviado",
  "em-conferencia": "Recebido, aguardando conferência",
  conferido: "Conferido",
  "complementacao-solicitada": "A escola pediu outro arquivo",
  recusado: "Não aceito — envie outro arquivo",
};
export const NON_BLOCKING_NOTICE =
  "Documento pendente não impede o atendimento: o pedido continua valendo e a escola orienta como completar.";

export function fileProblem(f: { type: string; size: number }): string | null {
  if (!(ALLOWED_MIME as readonly string[]).includes(f.type)) return "Envie PDF, JPG ou PNG.";
  if (f.size < 1) return "O arquivo está vazio.";
  if (f.size > MAX_BYTES) return "O arquivo passa de 10 MB.";
  return null;
}

/** Situação vigente = última conferência (ignorando vínculo ao GED); sem conferência ⇒ depende do arquivo existir. */
export function currentSituation(reviews: { seq: number; outcome: string }[], uploaded: boolean): DocSituation {
  const last = [...reviews].filter((r) => r.outcome !== "vinculado-ged").sort((a, b) => b.seq - a.seq)[0];
  if (last) return last.outcome as DocSituation;
  return uploaded ? "em-conferencia" : "nao-enviado";
}

/** Projeção do pedido: nunca devolve "bloqueado". Pendências só listam o que falta. */
export function applicationDocumentStanding(docs: { docType: DocType; situation: DocSituation }[]) {
  const latest = new Map<DocType, DocSituation>();
  for (const d of docs) latest.set(d.docType, d.situation);
  const pending = [...latest].filter(([, s]) => s !== "conferido" && s !== "em-conferencia").map(([t]) => t);
  return { pending, blocksApplication: false as const, blocksEducationRight: false as const };
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type UploadResult = "ok" | "ja-registrado" | "indisponivel" | "invalido" | "limite" | "falha-envio";

export async function uploadApplicationDocument(code: string, check: string, docType: DocType, file: File, key: string): Promise<UploadResult> {
  if (fileProblem(file)) return "invalido";
  const sha = await sha256Hex(await file.arrayBuffer());
  const { data, error } = await supabase.rpc("enr_public_request_document_slot", {
    _code: code, _check: check, _doc_type: docType, _mime: file.type, _size: file.size, _sha256: sha, _key: key,
  });
  if (error) return "indisponivel";
  const row = (data as { status: string; object_path: string | null }[] | null)?.[0];
  if (!row || (row.status !== "ok" && row.status !== "ja-registrado") || !row.object_path) return (row?.status as UploadResult) ?? "indisponivel";
  const up = await supabase.storage.from("enr-documentos").upload(row.object_path, file, { contentType: file.type, upsert: false });
  if (up.error && !/exists|duplicate/i.test(up.error.message)) return "falha-envio";
  return row.status as UploadResult;
}
