/**
 * Matrículas L04 — portal público de ingresso (migration 0457).
 * Lê só `enr_public_campaigns` e `enr_public_protocol_status` (DEFINER, allowlist); nenhuma tabela.
 * Campanha aparece só publicada/suspensa; prazo é o da versão publicada; protocolo exige número + código de conferência
 * e qualquer falha responde "indisponível" igual, porque diferenciar permitiria enumeração.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PublicCampaign {
  campaign_id: string; cycle_year: number; cycle_term: string; kind: string; stage_ids: string[]; modality_ids: string[];
  schools: { school_id: string; name: string | null }[]; period_from: string; period_to: string; state: string;
  edital_verification_code: string | null; published_version: number;
}
export type ProtocolStatus = "recebido" | "em-andamento" | "arquivado" | "indisponivel";

export const PROTOCOL_STATUS_LABEL: Record<ProtocolStatus, string> = {
  recebido: "Pedido recebido. Aguarde a análise.",
  "em-andamento": "Pedido em andamento.",
  arquivado: "Pedido concluído e arquivado.",
  indisponivel: "Não foi possível confirmar este protocolo. Confira o número e o código de conferência impressos no comprovante.",
};
export const TERM_LABEL: Record<string, string> = { anual: "Ano letivo", "1-semestre": "1º semestre", "2-semestre": "2º semestre" };

export const PROTOCOL_RE = /^PROT-\d{4}-\d{1,8}$/;
export const CODE_RE = /^[0-9a-f]{12}$/;
export function normalizeProtocolInput(number: string, code: string) {
  return { number: number.trim().toUpperCase(), code: code.trim().toLowerCase().replace(/[\s-]/g, "") };
}
export function validProtocolInput(number: string, code: string) {
  const n = normalizeProtocolInput(number, code);
  return PROTOCOL_RE.test(n.number) && CODE_RE.test(n.code);
}

export type Window = "em-breve" | "aberta" | "suspensa" | "encerrada";
/** Situação do prazo na data de hoje; nunca altera a campanha. */
export function campaignWindow(c: Pick<PublicCampaign, "state" | "period_from" | "period_to">, today: string): Window {
  if (c.state === "suspensa") return "suspensa";
  if (today < c.period_from) return "em-breve";
  if (today > c.period_to) return "encerrada";
  return "aberta";
}
export const WINDOW_LABEL: Record<Window, string> = { "em-breve": "Abre em breve", aberta: "Inscrições abertas", suspensa: "Suspensa temporariamente", encerrada: "Prazo encerrado" };

/** Rótulo seguro para identificador sem tradução homologada: mostra o próprio identificador legível, nunca inventa nome. */
export function readableId(id: string) { return id.replace(/[-_]+/g, " "); }

export async function listPublicCampaigns(): Promise<PublicCampaign[]> {
  const { data, error } = await supabase.rpc("enr_public_campaigns");
  if (error) throw new Error("Não foi possível carregar as campanhas.");
  return (data ?? []) as unknown as PublicCampaign[];
}

export async function consultProtocol(number: string, code: string): Promise<{ status: ProtocolStatus; registered_on: string | null; last_update_on: string | null }> {
  const n = normalizeProtocolInput(number, code);
  if (!validProtocolInput(n.number, n.code)) return { status: "indisponivel", registered_on: null, last_update_on: null };
  const { data, error } = await supabase.rpc("enr_public_protocol_status", { _number: n.number, _code: n.code });
  if (error) throw new Error("Consulta indisponível no momento.");
  const r = (data as { status: string; registered_on: string | null; last_update_on: string | null }[] | null)?.[0];
  const status = (r && r.status in PROTOCOL_STATUS_LABEL ? r.status : "indisponivel") as ProtocolStatus;
  return status === "indisponivel" ? { status, registered_on: null, last_update_on: null } : { status, registered_on: r!.registered_on, last_update_on: r!.last_update_on };
}
