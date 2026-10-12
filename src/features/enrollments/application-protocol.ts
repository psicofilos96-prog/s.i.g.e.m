// Matrículas L10 — protocolo único por inscrição (migration 0462) sobre o registro canônico `register_protocol` (PROT-ano-seq).
// Emitido por pessoa da rede com `protocolar-solicitacoes`; idempotente por pedido. Protocolo NÃO equivale a vaga.
import { supabase } from "@/integrations/supabase/client";

export const PROTOCOL_IS_NOT_VACANCY =
  "Este comprovante mostra que o pedido foi recebido. Ele não garante vaga, reserva nem matrícula.";

export type Receipt =
  | { status: "indisponivel" }
  | { status: "ok"; protocolNumber: string | null; submittedOn: string; campaignKind: string; campaignYear: number; situation: "aguardando-protocolo" | "protocolado" };

export const SITUATION_LABEL = { "aguardando-protocolo": "Recebido — número de protocolo ainda não emitido", protocolado: "Protocolado" } as const;

export function parseReceipt(row: unknown): Receipt {
  const r = row as { status?: unknown; submitted_on?: unknown; campaign_kind?: unknown; campaign_year?: unknown; protocol_number?: unknown; situation?: unknown } | null;
  if (!r || r.status !== "ok" || typeof r.submitted_on !== "string" || typeof r.campaign_kind !== "string" || typeof r.campaign_year !== "number") return { status: "indisponivel" };
  const num = typeof r.protocol_number === "string" && /^PROT-\d{4}-\d{6}$/.test(r.protocol_number) ? r.protocol_number : null;
  const situation = num ? "protocolado" : "aguardando-protocolo";
  if (r.situation !== situation) return { status: "indisponivel" };
  return { status: "ok", protocolNumber: num, submittedOn: r.submitted_on, campaignKind: r.campaign_kind, campaignYear: r.campaign_year, situation };
}

export async function fetchReceipt(code: string, check: string): Promise<Receipt> {
  const { data, error } = await supabase.rpc("enr_public_application_receipt", { _code: code.trim(), _check: check.trim() });
  if (error) return { status: "indisponivel" };
  return parseReceipt((data as unknown[] | null)?.[0] ?? null);
}

/** Equipe: emite (ou reaproveita) o protocolo do pedido. Erros do banco viram motivos fechados. */
export async function protocolApplication(applicationId: string): Promise<{ ok: true; number: string; reused: boolean } | { ok: false; reason: string }> {
  const { data, error } = await supabase.rpc("enr_protocol_application", { _application: applicationId });
  if (error) return { ok: false, reason: /forbidden|no-person/.test(error.message) ? "sem-competencia" : "falha" };
  const row = (data as { protocol_number: string; reused: boolean }[] | null)?.[0];
  return row ? { ok: true, number: row.protocol_number, reused: row.reused } : { ok: false, reason: "falha" };
}
