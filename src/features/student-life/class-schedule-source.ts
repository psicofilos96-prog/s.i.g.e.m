/**
 * B4.4 — Fonte canônica da grade semanal recorrente da turma (somente leitura).
 *
 * Única porta TS para `class_schedule_at(classId, validOn, knownAt)`. Grade ≠ jornada ≠ turno ≠
 * calendário ≠ aula ministrada. Não há writer: competência institucional para manter grade não
 * está definida. Sem fallback de laboratório nem leitura da tabela antiga
 * `institutional_class_schedule_slots` (deprecated).
 */
import { supabase } from "@/integrations/supabase/client";

export type ScheduleTime = { validOn: string; knownAt: string };
export const captureScheduleKnownAt = (now: () => Date = () => new Date()): string => now().toISOString();

export const SCHEDULE_STATES = [
  "utilizavel",
  "bloqueada:jornada-ausente",
  "bloqueada:blocos-com-pendencia",
  "inconsistente:sobreposicao-de-blocos",
] as const;
export type ScheduleState = (typeof SCHEDULE_STATES)[number];

export const BLOCK_STATES = [
  "utilizavel",
  "bloqueada:jornada-ausente",
  "bloqueada:componente-inexistente-ou-inativo",
  "bloqueada:tipo-nao-homologado",
  "bloqueada:engagement-invalido",
  "bloqueada:bloco-fora-da-jornada",
  "inconsistente:sobreposicao-de-blocos",
] as const;
export type BlockState = (typeof BLOCK_STATES)[number];

export const COVERAGE_STATES = ["comprovada", "nao-comprovada", "nao-comprovada:leitura-curricular-interrompida", "nao-aplicavel"] as const;
export type CoverageState = (typeof COVERAGE_STATES)[number];

export type ScheduleBlock = {
  blockId: string; blockKey: string; weekday: number; startsAt: string; endsAt: string; minutes: number;
  componentId: string | null; componentVersion: number | null; componentName: string | null;
  nature: { schemeId: string; valueId: string; version: number; label: string | null } | null;
  engagementIds: string[]; state: BlockState; issues: BlockState[]; overlapsWith: string[];
  coverage: CoverageState; coverageMatrixIds: string[];
};
export type ScheduleDay = { weekday: number; minutes: number; blocks: ScheduleBlock[] };

export type ClassSchedule =
  | { kind: "negado"; classId: string; validOn: string; knownAt: string }
  | { kind: "ausente"; classId: string; validOn: string; knownAt: string }
  | {
      kind: "registrada"; classId: string; validOn: string; knownAt: string; state: ScheduleState;
      scheduleId: string; versionId: string; version: number; changeKind: string; validFrom: string;
      effectiveUntil: string | null; actRef: string; changeReason: string | null; recordedAt: string;
      days: ScheduleDay[]; weekMinutes: number;
    };

export type RawScheduleRow = {
  result_kind: string; class_id: string; valid_on: string; known_at: string; schedule_state: string | null; schedule_id: string | null;
  version_id: string | null; version: number | null; change_kind: string | null; valid_from: string | null; effective_until: string | null;
  originating_act_ref: string | null; change_reason: string | null; recorded_at: string | null; block_id: string | null; block_key: string | null;
  weekday: number | null; starts_at: string | null; ends_at: string | null; block_minutes: number | null; component_id: string | null;
  component_version: number | null; component_name: string | null; nature_scheme_id: string | null; nature_value_id: string | null;
  nature_value_version: number | null; nature_label: string | null; engagement_ids: string[] | null; block_state: string | null;
  block_issues: string[] | null; overlapping_block_keys: string[] | null; coverage_state: string | null; coverage_matrix_ids: string[] | null;
  day_minutes: number | null; week_minutes: number | null;
};

export class ScheduleShapeError extends Error {}
const hm = (t: string | null) => (t ?? "").slice(0, 5);
function closed<T extends string>(set: readonly T[], v: string | null, what: string): T {
  if (v && (set as readonly string[]).includes(v)) return v as T;
  throw new ScheduleShapeError(`schedule:unmapped-${what}:${v ?? "null"}`);
}

export function mapScheduleRows(rows: RawScheduleRow[], classId: string, t: ScheduleTime): ClassSchedule {
  const base = { classId, validOn: t.validOn, knownAt: t.knownAt };
  if (rows.length === 0 || rows.some((r) => r.result_kind === "access-denied")) return { kind: "negado", ...base };
  if (rows.length === 1 && rows[0]!.result_kind === "absent") return { kind: "ausente", ...base };
  const unknown = rows.filter((r) => r.result_kind !== "block");
  if (unknown.length) throw new ScheduleShapeError(`schedule:unmapped-result-kind:${unknown.map((r) => r.result_kind).join(",")}`);
  if (new Set(rows.map((r) => r.version_id)).size !== 1) throw new ScheduleShapeError("schedule:multiple-versions-in-response");
  const states = new Set(rows.map((r) => r.schedule_state));
  if (states.size !== 1) throw new ScheduleShapeError("schedule:multiple-states-in-response");
  const f = rows[0]!;
  const byDay = new Map<number, ScheduleDay>();
  for (const r of rows) {
    const wd = r.weekday!;
    const day = byDay.get(wd) ?? { weekday: wd, minutes: r.day_minutes ?? 0, blocks: [] };
    day.blocks.push({
      blockId: r.block_id!, blockKey: r.block_key!, weekday: wd, startsAt: hm(r.starts_at), endsAt: hm(r.ends_at), minutes: r.block_minutes ?? 0,
      componentId: r.component_id, componentVersion: r.component_version, componentName: r.component_name,
      nature: r.nature_value_id ? { schemeId: r.nature_scheme_id!, valueId: r.nature_value_id, version: r.nature_value_version!, label: r.nature_label } : null,
      engagementIds: r.engagement_ids ?? [],
      state: closed(BLOCK_STATES, r.block_state, "block-state"),
      issues: (r.block_issues ?? []).map((i) => closed(BLOCK_STATES, i, "block-issue")),
      overlapsWith: r.overlapping_block_keys ?? [],
      coverage: closed(COVERAGE_STATES, r.coverage_state, "coverage-state"),
      coverageMatrixIds: r.coverage_matrix_ids ?? [],
    });
    byDay.set(wd, day);
  }
  const days = [...byDay.values()].sort((a, b) => a.weekday - b.weekday);
  for (const d of days) d.blocks.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.blockKey.localeCompare(b.blockKey));
  return {
    kind: "registrada", ...base, state: closed(SCHEDULE_STATES, f.schedule_state, "schedule-state"),
    scheduleId: f.schedule_id!, versionId: f.version_id!, version: f.version!, changeKind: f.change_kind!, validFrom: f.valid_from!,
    effectiveUntil: f.effective_until, actRef: f.originating_act_ref!, changeReason: f.change_reason, recordedAt: f.recorded_at!,
    days, weekMinutes: f.week_minutes ?? 0,
  };
}

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcClient = { rpc: unknown };
export async function readClassSchedule(classId: string, t: ScheduleTime, client: RpcClient = supabase): Promise<ClassSchedule> {
  if (!t.validOn) throw new Error("schedule:valid-on-required");
  if (!t.knownAt) throw new Error("schedule:known-at-required");
  const r = await (client.rpc as (f: string, a: Record<string, unknown>) => Promise<RpcResult>)(
    "class_schedule_at", { _class_id: classId, _on: t.validOn, _known_at: t.knownAt });
  if (r.error) throw new Error(r.error.message); // ambiguidade/cadeia/jornada: fail-closed, nunca ausência
  return mapScheduleRows((r.data ?? []) as RawScheduleRow[], classId, t);
}

/** Só uma grade inteiramente utilizável alimenta aula prevista automática. */
export const scheduleIsUsable = (s: ClassSchedule): s is Extract<ClassSchedule, { kind: "registrada" }> =>
  s.kind === "registrada" && s.state === "utilizavel";

export const SCHEDULE_STATE_TEXT: Record<ScheduleState, string> = {
  utilizavel: "Grade registrada e estruturalmente consistente nesta data.",
  "bloqueada:jornada-ausente": "Grade registrada, mas a turma não tem jornada registrada nesta data; a grade não pode ser usada.",
  "bloqueada:blocos-com-pendencia": "Grade registrada com blocos impedidos; nenhuma aula prevista é gerada até a pendência ser resolvida institucionalmente.",
  "inconsistente:sobreposicao-de-blocos": "Há blocos simultâneos na grade; o sistema não escolhe entre eles e não gera aula prevista.",
};
export const BLOCK_STATE_TEXT: Record<BlockState, string> = {
  utilizavel: "Utilizável",
  "bloqueada:jornada-ausente": "Sem jornada registrada",
  "bloqueada:componente-inexistente-ou-inativo": "Componente sem cadastro vigente ou inativo nesta data",
  "bloqueada:tipo-nao-homologado": "Tipo de bloco informado não está homologado",
  "bloqueada:engagement-invalido": "Responsável sem atuação vigente nesta turma/componente",
  "bloqueada:bloco-fora-da-jornada": "Bloco fora da jornada da turma",
  "inconsistente:sobreposicao-de-blocos": "Simultâneo a outro bloco",
};
export const COVERAGE_TEXT: Record<CoverageState, string> = {
  comprovada: "Componente presente em matriz resolvida da turma",
  "nao-comprovada": "Cobertura curricular não comprovada",
  "nao-comprovada:leitura-curricular-interrompida": "Cobertura curricular não comprovada (leitura curricular interrompida)",
  "nao-aplicavel": "Sem componente",
};

/** Rótulo humano do bloco; nunca o ID técnico. */
export function blockLabel(b: ScheduleBlock): string {
  if (b.componentId) return b.componentName ?? "Componente sem nome legível";
  if (b.nature) return b.nature.label ?? "Tipo sem rótulo legível";
  return "Bloco previsto";
}

const MESSAGES: Record<string, string> = {
  "schedule:ambiguous-temporal-state": "Há mais de uma versão de grade vigente nesta data; nada foi escolhido.",
  "schedule:invalid-chain": "O histórico da grade está inconsistente; a leitura foi interrompida.",
  "schedule:outside-class-validity": "A grade registrada não cabe na existência da turma nesta data.",
  "journey:ambiguous-temporal-state": "A jornada da turma é ambígua nesta data; a grade não foi lida.",
  "journey:invalid-chain": "O histórico da jornada está inconsistente; a grade não foi lida.",
  "journey:outside-class-validity": "A jornada registrada não cabe na existência da turma; a grade não foi lida.",
  "schedule:unmapped": "Resposta da grade em formato não reconhecido; nada foi concluído.",
};
export function scheduleMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  const k = Object.keys(MESSAGES).find((x) => text.includes(x));
  return k ? MESSAGES[k]! : `Leitura interrompida sem conclusão: ${text}`;
}
