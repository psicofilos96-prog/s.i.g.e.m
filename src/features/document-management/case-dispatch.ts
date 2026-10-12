// L08 — Tramitação entre unidades. Escrita só por `dispatch_admin_case` / `record_dispatch_event`;
// anexo sensível só por `read_sensitive_case_document` (finalidade + trilha). Situação é projeção.
import { supabase } from "@/integrations/supabase/client";

export interface Dispatch {
  id: string; dispatchSeq: number; fromUnitId: string; toUnitId: string;
  responsibleEngagementId: string | null; dueOn: string | null; dueBasis: string | null;
}
export interface DispatchEvent { dispatchId: string; eventType: "recebido" | "devolvido" | "responsavel_assumiu"; responsibleEngagementId: string | null }

export type DispatchSituation = "em-transito" | "recebido" | "devolvido";

export function dispatchSituation(d: Dispatch, events: readonly DispatchEvent[], today: string) {
  const mine = events.filter((e) => e.dispatchId === d.id);
  const settled = mine.find((e) => e.eventType === "recebido" || e.eventType === "devolvido");
  const situation: DispatchSituation = settled ? (settled.eventType as DispatchSituation) : "em-transito";
  const assumed = [...mine].reverse().find((e) => e.eventType === "responsavel_assumiu");
  const responsible = assumed?.responsibleEngagementId ?? d.responsibleEngagementId;
  // Prazo só existe se declarado com fundamento; sem prazo nunca é "atrasado".
  const overdue = d.dueOn ? situation !== "devolvido" && today > d.dueOn : null;
  return { situation, responsible, overdue };
}

export function currentUnit(caseUnit: string, dispatches: readonly Dispatch[], events: readonly DispatchEvent[]): string {
  const received = [...dispatches].sort((a, b) => b.dispatchSeq - a.dispatchSeq)
    .find((d) => events.some((e) => e.dispatchId === d.id && e.eventType === "recebido"));
  return received?.toUnitId ?? caseUnit;
}

const REFUSALS: Record<string, string> = {
  "dispatch:forbidden": "Sem a capacidade 'instruir-processos' na unidade onde o processo está.",
  "dispatch:pending-receipt": "Há tramitação aguardando recebimento.",
  "dispatch:stale-base": "A tramitação mudou desde a leitura; recarregue.",
  "dispatch:case-concluded": "Processo concluído não tramita; reabra antes.",
  "dispatch:invalid-destination": "Destino deve ser outra unidade.",
  "dispatch:due-without-basis": "Prazo exige fundamento (norma ou decisão).",
  "dispatch:already-settled": "Esta tramitação já foi recebida ou devolvida.",
  "dispatch:justification-required": "Devolução exige justificativa.",
  "dispatch:not-received": "Responsável só assume após o recebimento.",
  "sensitive:forbidden": "Sem a capacidade 'ler-anexos-sensiveis'.",
  "sensitive:purpose-required": "Informe a finalidade do acesso.",
};
export function explainDispatchError(msg: string): string {
  const k = Object.keys(REFUSALS).find((x) => msg.includes(x));
  return (k && REFUSALS[k]) || "Falha na tramitação; nada foi registrado.";
}

export async function readSensitiveDocument(caseEventId: string, purpose: string) {
  const { data, error } = await supabase.rpc("read_sensitive_case_document", { _case_event_id: caseEventId, _purpose: purpose });
  if (error) return { ok: false as const, reason: explainDispatchError(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { ok: true as const, documentRef: row.document_ref as string } : { ok: false as const, reason: "Documento indisponível." };
}
