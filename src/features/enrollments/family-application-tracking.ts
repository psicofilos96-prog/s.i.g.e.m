/**
 * Matrículas — acompanhamento do pedido pela família (rota pública `/publico/acompanhar-inscricao`).
 * Junta, só pelo código do pedido + código de conferência, as leituras públicas já existentes
 * (comprovante L10, documentos L09, resultado L18, lista de espera L17, aceite L19). Qualquer falha de
 * conferência vira um único "indisponível" para todas as partes, porque respostas diferentes por parte
 * permitiriam descobrir pedidos de outras famílias. Próximos passos são derivados, nunca gravados.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchReceipt, type Receipt } from "./application-protocol";
import { consultResult, validResultInput, type IndividualResult } from "./individual-result";
import { currentSituation, DOC_TYPES, type DocSituation, type DocType } from "./application-documents";

export interface DocRow { docType: DocType; situation: DocSituation }
export interface Waitlist { listCell: string | null; position: number; total: number; wasCalled: boolean }
export type Tracking =
  | { status: "indisponivel" }
  | { status: "ok"; receipt: Extract<Receipt, { status: "ok" }>; documents: DocRow[]; result: IndividualResult; waitlist: Waitlist | null };

export const UNAVAILABLE_TEXT =
  "Não foi possível confirmar este pedido. Confira o número da inscrição (INS-…) e o código de conferência impressos no comprovante.";

export function normalizeTrackingInput(code: string, check: string) {
  return { code: code.trim().toUpperCase(), check: check.trim().toLowerCase().replace(/[\s-]/g, "") };
}

/** Documentos: só tipos conhecidos; a última versão de cada tipo define a situação. */
export function parseDocuments(rows: unknown): DocRow[] {
  if (!Array.isArray(rows)) return [];
  const latest = new Map<DocType, { v: number; s: DocSituation }>();
  for (const r of rows as { doc_type?: unknown; version?: unknown; situation?: unknown }[]) {
    if (typeof r?.doc_type !== "string" || !(r.doc_type in DOC_TYPES) || typeof r.version !== "number") continue;
    const s = typeof r.situation === "string" ? r.situation : "";
    const sit = currentSituation(s && s !== "em-conferencia" ? [{ seq: 1, outcome: s }] : [], true);
    const prev = latest.get(r.doc_type as DocType);
    if (!prev || r.version > prev.v) latest.set(r.doc_type as DocType, { v: r.version, s: sit });
  }
  return [...latest].map(([docType, x]) => ({ docType, situation: x.s }));
}

export function parseWaitlist(rows: unknown): Waitlist | null {
  const r = (Array.isArray(rows) ? rows[0] : null) as { status?: unknown; list_cell?: unknown; queue_position?: unknown; queue_total?: unknown; was_called?: unknown } | null;
  if (!r || r.status !== "ok" || typeof r.queue_position !== "number" || typeof r.queue_total !== "number") return null;
  if (r.queue_position < 1 || r.queue_position > r.queue_total) return null;
  return { listCell: typeof r.list_cell === "string" ? r.list_cell : null, position: r.queue_position, total: r.queue_total, wasCalled: r.was_called === true };
}

export interface NextStep { id: string; text: string; action?: "enviar-documento" | "confirmar-vaga" }

/** Próximos passos em linguagem simples, a partir só do que foi lido. Sem dado ⇒ nenhum passo inventado. */
export function nextSteps(t: Extract<Tracking, { status: "ok" }>): NextStep[] {
  const out: NextStep[] = [];
  if (t.receipt.situation === "aguardando-protocolo") out.push({ id: "protocolo", text: "Aguarde: a Secretaria vai emitir o número de protocolo do pedido." });
  const pending = t.documents.filter((d) => d.situation === "complementacao-solicitada" || d.situation === "recusado");
  if (pending.length) out.push({ id: "docs", action: "enviar-documento", text: `Envie outro arquivo para: ${pending.map((d) => DOC_TYPES[d.docType]).join(", ")}.` });
  else if (!t.documents.length) out.push({ id: "docs-opc", action: "enviar-documento", text: "Se quiser, envie os documentos do edital por aqui. Isso não é obrigatório para o pedido valer." });
  const s = t.result.status === "ok" ? t.result.situation : null;
  if (s === "vaga-reservada") out.push({ id: "aceite", action: "confirmar-vaga", text: t.result.deadline ? `Confirme o interesse na vaga até ${t.result.deadline.split("-").reverse().join("/")}.` : "Confirme o interesse na vaga." });
  else if (s === "contemplado") out.push({ id: "reserva", text: "Aguarde a escola reservar a vaga. Depois, volte aqui para confirmar." });
  else if (s === "vaga-confirmada") out.push({ id: "matricula", text: "Vaga confirmada. A escola vai orientar a matrícula." });
  else if (s === "lista-de-espera") out.push({ id: "espera", text: "Você está na lista de espera. Se for chamado, a reserva aparecerá aqui." });
  else if (t.result.status === "sem-resultado-publicado") out.push({ id: "aguardar", text: "Aguarde a divulgação do resultado da campanha." });
  if (t.result.status === "ok" && t.result.next_step) out.push({ id: "oficial", text: t.result.next_step });
  return out;
}

export async function trackApplication(codeIn: string, checkIn: string): Promise<Tracking> {
  const { code, check } = normalizeTrackingInput(codeIn, checkIn);
  if (!validResultInput(code, check)) return { status: "indisponivel" };
  const receipt = await fetchReceipt(code, check);
  if (receipt.status !== "ok") return { status: "indisponivel" };
  const [docs, result, wl] = await Promise.all([
    supabase.rpc("enr_public_application_documents", { _code: code, _check: check }),
    consultResult(code, check),
    supabase.rpc("enr_public_waitlist_position", { _code: code, _check: check }),
  ]);
  if (docs.error || wl.error) throw new Error("consulta-indisponivel");
  return { status: "ok", receipt, documents: parseDocuments(docs.data), result, waitlist: parseWaitlist(wl.data) };
}
