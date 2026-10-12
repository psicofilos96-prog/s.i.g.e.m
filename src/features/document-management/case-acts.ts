// L10 — Despachos, pareceres, encaminhamentos e decisões. Escrita só por `record_admin_case_act`:
// competência por espécie (decisão: decidir-processos; parecer: emitir-pareceres; demais: instruir-processos),
// versões append-only com base esperada e motivo, referências tipadas, autor = pessoa da sessão.
import { supabase } from "@/integrations/supabase/client";

export type ActKind = "despacho" | "parecer" | "encaminhamento" | "decisao";
export type ActRefKind = "documento" | "ato" | "norma" | "protocolo";
export interface ActRef { kind: ActRefKind; id: string }
export interface ActVersion { version: number; body: string; outcome: string | null; authorPerson: string; changeReason: string | null; refs: ActRef[] }

export const ACT_CAPABILITY: Record<ActKind, string> = {
  decisao: "decidir-processos", parecer: "emitir-pareceres", despacho: "instruir-processos", encaminhamento: "instruir-processos",
};

/** Pré-checagem da tela (o banco revalida). */
export function actProblems(kind: ActKind, v: { body: string; outcome?: string; refs: ActRef[]; changeReason?: string }, isNewVersion: boolean): string[] {
  const p: string[] = [];
  if (v.body.trim().length < 10) p.push("Texto com no mínimo 10 caracteres.");
  if (kind === "decisao" && !v.outcome?.trim()) p.push("Decisão exige dispositivo (resultado).");
  if (kind === "decisao" && v.refs.length === 0) p.push("Decisão exige ao menos uma referência (documento, parecer, norma ou protocolo).");
  if (isNewVersion && (v.changeReason?.trim().length ?? 0) < 10) p.push("Nova versão exige motivo.");
  if (v.refs.some((r) => !r.id.trim())) p.push("Referência sem identificador.");
  return p;
}

export function currentVersion(versions: readonly ActVersion[]): ActVersion | null {
  return [...versions].sort((a, b) => b.version - a.version)[0] ?? null;
}

const REFUSALS: Record<string, string> = {
  "act:forbidden": "Sem a competência exigida para esta espécie de ato na unidade do processo.",
  "act:case-concluded": "Processo concluído; reabra antes de novo ato.",
  "act:decision-without-outcome": "Decisão exige dispositivo.",
  "act:decision-without-references": "Decisão exige referências.",
  "act:decision-on-own-opinion": "Quem emitiu o parecer não decide com base nele.",
  "act:opinion-by-decider": "Quem já decidiu neste processo não emite parecer nele.",
  "act:stale-base": "O ato mudou desde a leitura; recarregue.",
  "act:reason-required": "Nova versão exige motivo.",
  "act:invalid-reference": "Referência inválida.",
};
export function explainActError(msg: string): string {
  const k = Object.keys(REFUSALS).find((x) => msg.includes(x));
  return (k && REFUSALS[k]) || "Falha ao registrar o ato; nada foi gravado.";
}

export async function recordCaseAct(i: {
  caseId: string; actId: string | null; kind: ActKind; expectedVersion: number; body: string;
  outcome?: string; changeReason?: string; refs: ActRef[]; idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc("record_admin_case_act", {
    _case_id: i.caseId, _act_id: i.actId as string, _act_kind: i.kind, _expected_version: i.expectedVersion,
    _body: i.body, _outcome: i.outcome ?? "", _change_reason: i.changeReason ?? "",
    _references: i.refs as unknown as never, _idempotency_key: i.idempotencyKey,
  });
  if (error) return { ok: false as const, reason: explainActError(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { ok: true as const, actId: row.act_id as string, version: row.version as number } : { ok: false as const, reason: "Falha ao registrar o ato." };
}
