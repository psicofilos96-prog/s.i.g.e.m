// L07 — Processo administrativo. Escrita só por `open_admin_case` / `record_admin_case_event`
// (append-only, seq esperado). Estado, autos ordenados e histórico são projeções dos eventos.
import { supabase } from "@/integrations/supabase/client";

export type CaseEventType = "autuado" | "documento_juntado" | "instrucao" | "manifestacao" | "encaminhado" | "concluido" | "reaberto";
export interface CaseEvent {
  seq: number; eventType: CaseEventType; documentOrder: number | null; documentRef: string | null;
  toUnitId: string | null; authorPerson: string; createdAt: string;
}

export function caseProjection(events: readonly CaseEvent[]) {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  let status: "sem-autuacao" | "aberto" | "concluido" = "sem-autuacao";
  let unit: string | null = null; let reopenings = 0;
  for (const e of sorted) {
    if (e.eventType === "autuado") status = "aberto";
    else if (e.eventType === "concluido") status = "concluido";
    else if (e.eventType === "reaberto") { status = "aberto"; reopenings++; }
    else if (e.eventType === "encaminhado") unit = e.toUnitId;
  }
  const autos = sorted.filter((e) => e.eventType === "documento_juntado")
    .sort((a, b) => (a.documentOrder ?? 0) - (b.documentOrder ?? 0));
  return { status, currentUnit: unit, reopenings, autos, lastSeq: sorted.at(-1)?.seq ?? 0, history: sorted };
}

/** Ações que a tela pode oferecer; o banco revalida tudo. */
export function allowedActions(status: ReturnType<typeof caseProjection>["status"]): CaseEventType[] {
  if (status === "concluido") return ["reaberto"];
  if (status === "aberto") return ["documento_juntado", "instrucao", "manifestacao", "encaminhado", "concluido"];
  return [];
}

const REFUSALS: Record<string, string> = {
  "case:no-person": "Sessão sem pessoa institucional vinculada.",
  "case:forbidden": "Sem a capacidade 'instruir-processos' para esta unidade.",
  "case:reopen-forbidden": "Reabrir exige a capacidade 'reabrir-processos'.",
  "case:concluded": "Processo concluído só aceita reabertura justificada.",
  "case:not-concluded": "Só processo concluído pode ser reaberto.",
  "case:stale-base": "O processo mudou desde a leitura; recarregue.",
  "case:text-required": "Manifestação, instrução, conclusão e reabertura exigem texto (mín. 10 caracteres).",
  "case:document-invalid": "Juntada exige referência e SHA-256 do documento.",
  "case:missing-destination": "Encaminhamento exige unidade de destino.",
  "case:idempotency-conflict": "Esta chave já autuou outro processo.",
  "case:missing-field": "Informe classificação e chave de idempotência.",
};
export function explainCaseError(msg: string): string {
  const k = Object.keys(REFUSALS).find((x) => msg.includes(x));
  return (k && REFUSALS[k]) || "Falha no processo; nada foi registrado.";
}

export async function recordCaseEvent(i: {
  caseId: string; expectedSeq: number; eventType: Exclude<CaseEventType, "autuado">;
  documentRef?: string; contentSha256?: string; toUnitId?: string; textBody?: string;
}) {
  const { data, error } = await supabase.rpc("record_admin_case_event", {
    _case_id: i.caseId, _expected_seq: i.expectedSeq, _event_type: i.eventType,
    _document_ref: i.documentRef ?? "", _content_sha256: i.contentSha256 ?? "",
    _to_unit_id: i.toUnitId ?? "", _text_body: i.textBody ?? "",
  });
  return error ? { ok: false as const, reason: explainCaseError(error.message) } : { ok: true as const, seq: data as number };
}
