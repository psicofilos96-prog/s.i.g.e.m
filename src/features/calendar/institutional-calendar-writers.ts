/**
 * B4.6.7b — Chamadas aos writers institucionais do calendário (o banco é a autoridade final).
 * A tela só coleta; cada função envia base esperada, ato e motivo, e traduz a recusa do banco por extenso.
 */
import { supabase } from "@/integrations/supabase/client";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
const defaultRpc: Rpc = (fn, args) => supabase.rpc(fn as "calendar_list_at", args as never) as never;

export class CalendarWriteRefused extends Error {
  constructor(readonly code: string) { super(writeRefusalText(code)); }
}

const TEXT: Record<string, string> = {
  "session-required": "É preciso estar com a sessão ativa.",
  "person-link-required": "Sua conta não está vinculada a uma pessoa institucional.",
  "act-required": "Informe o ato que fundamenta o registro.",
  "reason-required": "Informe o motivo da alteração.",
  "base-superseded": "Outra pessoa registrou uma versão depois que você abriu esta tela. Recarregue e revise antes de gravar.",
  "invalid-change-kind": "Tipo de alteração inválido para o estado atual.",
  "label-required": "Informe o nome do tipo de dia.",
  "valid-from-required": "Informe o início da vigência.",
  "ends-before-start": "O término da vigência é anterior ao início.",
  "scopes-required": "Declare ao menos um recorte de aplicabilidade.",
  "conditions-required": "Cada recorte precisa de ao menos uma condição.",
  "window-outside-version": "A janela do recorte está fora da vigência da versão.",
  "window-outside-academic-year": "A janela do recorte está fora do ano letivo ativo.",
  "already-recorded": "A apresentação desta versão já foi registrada.",
  "version-already-decided": "A versão já recebeu decisão de homologação; a apresentação não pode mais ser anexada.",
  "invalid-decision": "Decisão inválida.",
  "effective-from-required": "Informe a data de efeito da decisão.",
  "titulo-obrigatorio": "Informe o título do calendário (ex.: Calendário Regular 2027).",
  "titulo-repetido": "Já existe outro calendário com este título no mesmo ano letivo; use títulos distintos (ex.: Regular e EJA).",
  "type-not-in-version": "Este tipo de dia não está declarado nesta versão do calendário.",
  "duplicate-type": "O mesmo tipo de dia foi indicado duas vezes.",
  "role-required": "Informe o nome do papel de conselho (ex.: Conselho de Classe).",
  "roles-required": "Declare os papéis de conselho ou marque que nenhum tipo é conselho.",
  "titulos-nao-lidos": "Os títulos dos calendários existentes ainda não foram lidos; aguarde e tente de novo.",
};
export function writeRefusalText(code: string): string {
  if (code.startsWith("capability:")) return "Sua atuação vigente não tem a capacidade exigida para este registro.";
  const tail = code.split(":").slice(1).join(":");
  return TEXT[tail] ?? TEXT[code] ?? `O banco recusou o registro (${code}). Nada foi gravado.`;
}

async function call(fn: string, args: Record<string, unknown>, rpc: Rpc): Promise<Record<string, unknown>> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new CalendarWriteRefused(String(error.message ?? "erro"));
  if (!data || typeof data !== "object") throw new CalendarWriteRefused("resposta-inesperada");
  return data as Record<string, unknown>;
}
const req = (s: string, what: string) => { if (!s.trim()) throw new CalendarWriteRefused(`form:${what}`); return s.trim(); };

export function recordDayTypeVersion(p: {
  dayTypeId: string | null; baseVersionId: string | null; label: string; schoolDayEffect: boolean | null; actRef: string; reason: string;
}, rpc: Rpc = defaultRpc) {
  return call("record_calendar_day_type_version", {
    _day_type: p.dayTypeId, _base_version_id: p.baseVersionId, _change_kind: p.dayTypeId ? "sucessao" : "constituicao",
    _label: req(p.label, "label-required"), _school_day_effect: p.schoolDayEffect, _act_ref: req(p.actRef, "act-required"), _reason: p.reason.trim() || null,
  }, rpc);
}

/** Norma exclusiva: multiplicidade `exigir-exclusividade`, sem regras de dimensão (nenhuma prioridade), vínculo school_day_effect. */
export function recordExclusiveNormVersion(p: {
  normId: string | null; baseVersionId: string | null; validFrom: string; validUntil: string | null; actRef: string; reason: string;
}, rpc: Rpc = defaultRpc) {
  return call("record_calendar_composition_norm_version", {
    _norm_id: p.normId, _base_version_id: p.baseVersionId, _change_kind: p.normId ? "sucessao" : "constituicao",
    _valid_from: p.validFrom, _valid_until: p.validUntil, _act_ref: req(p.actRef, "act-required"), _reason: p.reason.trim() || null,
    _multiplicity: "exigir-exclusividade", _dimension_rules: [],
    _effect_bindings: [{ dimensionId: "efeito-dia", effectPrimitive: "school_day_effect", effectContractVersion: 1 }],
  }, rpc);
}

export type Decision = "homologada" | "revogada";
export function decideNorm(p: { versionId: string; expectedLastId: string | null; decision: Decision; effectiveFrom: string; actRef: string; reason: string }, rpc: Rpc = defaultRpc) {
  return call("homologate_calendar_composition_norm", {
    _version_id: p.versionId, _expected_last_homologation_id: p.expectedLastId, _decision: p.decision,
    _effective_from: p.effectiveFrom, _act_ref: req(p.actRef, "act-required"), _reason: p.reason.trim() || null,
  }, rpc);
}
export function decideCalendar(p: { versionId: string; expectedLastId: string | null; decision: Decision; effectiveFrom: string; actRef: string; reason: string }, rpc: Rpc = defaultRpc) {
  return call("homologate_calendar_version", {
    _calendar_version_id: p.versionId, _expected_last_homologation_id: p.expectedLastId, _decision: p.decision,
    _effective_from: p.effectiveFrom, _act_ref: req(p.actRef, "act-required"), _reason: p.reason.trim() || null,
  }, rpc);
}

export type ScopeInput = {
  scopeKey: string; label: string; windowFrom: string; windowUntil: string;
  conditions: ({ kind: "escola"; school_id: string } | { kind: "valor-de-eixo"; scheme_id: string; value_id: string; value_version: number }
    | { kind: "alocacao"; allocation_logical_id: string } | { kind: "posicao-curricular"; position_logical_id: string })[];
};
export function recordCalendarVersion(p: {
  calendarId: string | null; baseVersionId: string | null; academicYearId: string; periodOrganizationId: string;
  validFrom: string; validUntil: string | null; actRef: string; reason: string; periodIds: string[];
  days: { day: string; day_type_version_id: string }[]; scopes: ScopeInput[];
  /** Descrição da data: mesma declaração de tipo do dia (mesmo efeito), só para rótulo. */
  events?: { starts_on: string; ends_on: string; label: string; day_type_version_id: string }[];
}, rpc: Rpc = defaultRpc) {
  return call("record_calendar_version_with_windowed_applicability", {
    _calendar: p.calendarId, _base_version_id: p.baseVersionId, _change_kind: p.calendarId ? "sucessao" : "constituicao",
    _academic_year_id: p.academicYearId, _period_organization_id: p.periodOrganizationId,
    _valid_from: p.validFrom, _valid_until: p.validUntil, _act_ref: req(p.actRef, "act-required"), _reason: p.reason.trim() || null,
    _periods: p.periodIds, _ranges: [], _events: p.events ?? [], _days: p.days,
    _applicability: p.scopes.map((s) => ({ scope_key: s.scopeKey, label: s.label, window_from: s.windowFrom, window_until: s.windowUntil, conditions: s.conditions })),
  }, rpc);
}

export function recordPresentationSnapshot(p: {
  versionId: string; sourceKind: "importacao-navegador" | "referencia-codigo" | "edicao-institucional"; sourceKey: string | null;
  sourceEntryId: string | null; digest: string; raw: unknown; presentation: Record<string, unknown>; note: string | null;
}, rpc: Rpc = defaultRpc) {
  return call("record_calendar_presentation_snapshot", {
    _version_id: p.versionId, _source_kind: p.sourceKind, _source_key: p.sourceKey, _source_entry_id: p.sourceEntryId,
    _source_digest: p.digest, _source_raw: p.raw ?? null, _presentation: p.presentation, _declared_note: p.note,
  }, rpc);
}
