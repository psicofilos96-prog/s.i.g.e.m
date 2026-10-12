// L05 — Numeração institucional. A emissão real é SÓ `allocate_document_number`
// (lock por tipo+unidade+ano, unicidade no banco, idempotência por chave).
// Este módulo é a pré-visualização pura e o tradutor de recusas.
import { supabase } from "@/integrations/supabase/client";

export interface NumberingRule {
  pattern: string; // deve conter {seq}; aceita {ano} e {unidade}
  seqPadding: number;
  status: "rascunho" | "aprovada" | "revogada";
  decisionRef: string | null;
}

export function formatNumber(rule: NumberingRule, unit: string, year: number, seq: number): string {
  if (!rule.pattern.includes("{seq}")) throw new Error("numbering:pattern-without-seq");
  if (!Number.isInteger(seq) || seq < 1) throw new Error("numbering:invalid-seq");
  return rule.pattern
    .replace("{seq}", String(seq).padStart(rule.seqPadding, "0"))
    .replace("{ano}", String(year))
    .replace("{unidade}", unit);
}

export function ruleIsEffective(rule: NumberingRule): boolean {
  return rule.status === "aprovada" && !!rule.decisionRef;
}

/** Próximo número = maior já emitido + 1; cancelado nunca é reutilizado. */
export function nextSeq(issued: readonly number[]): number {
  return issued.reduce((m, s) => Math.max(m, s), 0) + 1;
}

export const NUMBERING_REFUSALS: Record<string, string> = {
  "numbering:no-person": "Sessão sem pessoa institucional vinculada.",
  "numbering:forbidden": "Sem a capacidade 'numerar-documentos' para esta unidade.",
  "numbering:no-approved-rule": "Não há regra de numeração aprovada para este tipo.",
  "numbering:missing-reference": "Informe o documento e a chave de idempotência.",
  "numbering:idempotency-conflict": "Esta chave já numerou outro documento.",
  "numbering:append-only": "Número emitido é imutável; use cancelamento justificado.",
};

export function explainNumberingError(message: string): string {
  const key = Object.keys(NUMBERING_REFUSALS).find((k) => message.includes(k));
  return (key && NUMBERING_REFUSALS[key]) || "Falha ao numerar; nenhum número foi emitido.";
}

export async function allocateDocumentNumber(input: {
  documentTypeKey: string; unitId: string; year: number; subjectRef: string; idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc("allocate_document_number", {
    _document_type_key: input.documentTypeKey, _unit_id: input.unitId, _year: input.year,
    _subject_ref: input.subjectRef, _idempotency_key: input.idempotencyKey,
  });
  if (error) return { ok: false as const, reason: explainNumberingError(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false as const, reason: "Falha ao numerar; nenhum número foi emitido." };
  return { ok: true as const, number: row.formatted as string, seq: row.seq as number, reused: row.reused as boolean };
}
