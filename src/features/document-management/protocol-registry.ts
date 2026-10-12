// L06 — Protocolo único. Registrar = receber; NUNCA deferir (decisão vive na Tramitação).
// Escrita só por `register_protocol` / `record_protocol_event` (append-only, seq esperado).
import { supabase } from "@/integrations/supabase/client";

export type ProtocolChannel = "interno" | "presencial" | "digital";
export type ProtocolEventType = "registrado" | "encaminhado" | "recebido" | "juntada" | "anotacao" | "arquivado" | "desarquivado";
export interface ProtocolEvent { seq: number; eventType: ProtocolEventType; toUnitId: string | null }

/** Estado do protocolo é projeção dos eventos; nunca contém deferido/indeferido. */
export function protocolState(events: readonly ProtocolEvent[]): { status: string; unit: string | null; lastSeq: number } {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  let status = "sem-registro"; let unit: string | null = null;
  for (const e of sorted) {
    if (e.eventType === "encaminhado") { status = "em-transito"; unit = e.toUnitId; }
    else if (e.eventType === "recebido") status = "recebido";
    else if (e.eventType === "arquivado") status = "arquivado";
    else if (e.eventType === "desarquivado" || e.eventType === "registrado") status = "registrado";
  }
  return { status, unit, lastSeq: sorted.at(-1)?.seq ?? 0 };
}

export function receiptText(r: { protocolNumber: string; channel: ProtocolChannel; subject: string; receiptHash: string; registeredAt: string }): string {
  return [
    `Comprovante de protocolo ${r.protocolNumber}`,
    `Canal: ${r.channel} · Registrado em: ${r.registeredAt}`,
    `Assunto: ${r.subject}`,
    `Código de conferência: ${r.receiptHash.slice(0, 16)}`,
    "Este comprovante atesta o recebimento da solicitação. Protocolo não é deferimento.",
  ].join("\n");
}

const REFUSALS: Record<string, string> = {
  "protocol:no-person": "Sessão sem pessoa institucional vinculada.",
  "protocol:forbidden": "Sem a capacidade 'protocolar-solicitacoes' para esta unidade.",
  "protocol:missing-field": "Informe classificação e chave de idempotência.",
  "protocol:idempotency-conflict": "Esta chave já protocolou outra solicitação.",
  "protocol:stale-base": "O protocolo mudou desde a leitura; recarregue antes de continuar.",
  "protocol:missing-destination": "Encaminhamento exige unidade de destino.",
  "protocol:invalid-event": "Evento não permitido.",
};
export function explainProtocolError(msg: string): string {
  const k = Object.keys(REFUSALS).find((x) => msg.includes(x));
  return (k && REFUSALS[k]) || "Falha ao protocolar; nada foi registrado.";
}

export async function registerProtocol(i: {
  channel: ProtocolChannel; originUnitId: string; interestedPersonId: string | null; interestedExternalRef: string | null;
  subject: string; classificationCode: string; idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc("register_protocol", {
    _channel: i.channel, _origin_unit_id: i.originUnitId, _interested_person_id: i.interestedPersonId as string,
    _interested_external_ref: i.interestedExternalRef as string, _subject: i.subject,
    _classification_code: i.classificationCode, _idempotency_key: i.idempotencyKey,
  });
  if (error) return { ok: false as const, reason: explainProtocolError(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false as const, reason: "Falha ao protocolar; nada foi registrado." };
  return { ok: true as const, protocolNumber: row.protocol_number as string, receiptHash: row.receipt_hash as string, reused: row.reused as boolean };
}
