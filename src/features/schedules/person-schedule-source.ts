/**
 * B4.5 — Fonte canônica do "Meu horário": projeção pura de `person_schedule_at(personId, validOn, knownAt)`.
 *
 * pessoa → atuações vigentes → blocos B4.4 (class_schedule_at) → horários/conflitos POTENCIAIS.
 * Não persiste nada, não tem writer e só consulta a PRÓPRIA pessoa (current_person_id): visibilidade
 * gerencial de terceiros é decisão institucional aberta. Sem fixtures nem tabela antiga de slots.
 */
import { supabase } from "@/integrations/supabase/client";
import { BLOCK_STATES, SCHEDULE_STATES, type BlockState, type ScheduleState } from "@/features/student-life/class-schedule-source";

export type PersonScheduleTime = { validOn: string; knownAt: string };
export const capturePersonScheduleKnownAt = (now: () => Date = () => new Date()): string => now().toISOString();

export const UNAVAILABLE_STATES = ["turma-nao-legivel", "erro-de-leitura"] as const;
export type UnavailableState = (typeof UNAVAILABLE_STATES)[number];

export type PersonBlock = {
  blockId: string; blockKey: string; classId: string; schoolId: string | null; scheduleId: string; versionId: string; version: number;
  weekday: number; startsAt: string; endsAt: string; minutes: number;
  componentId: string | null; componentName: string | null; natureLabel: string | null;
  ownEngagementIds: string[]; sourceState: ScheduleState; blockState: BlockState; operational: boolean;
};
export type PersonConflict = {
  blockId: string; otherBlockId: string; classId: string; otherClassId: string; weekday: number; overlapStartsAt: string; overlapEndsAt: string;
};
export type PersonSourceUnavailable = { classId: string; state: UnavailableState; issue: string | null };

export type PersonSchedule =
  | { kind: "negado"; validOn: string; knownAt: string }
  | { kind: "ausente"; validOn: string; knownAt: string }
  | {
      kind: "projetado"; validOn: string; knownAt: string;
      blocks: PersonBlock[]; conflicts: PersonConflict[]; unavailable: PersonSourceUnavailable[];
      operationalBlockCount: number; unavailableBlockCount: number; weekMinutes: number; conflictCount: number;
    };

export type RawPersonRow = {
  result_kind: string; valid_on: string; known_at: string; class_id: string | null; school_id: string | null;
  source_state: string | null; source_issue: string | null; schedule_id: string | null; version_id: string | null; version: number | null;
  block_id: string | null; block_key: string | null; weekday: number | null; starts_at: string | null; ends_at: string | null;
  block_minutes: number | null; component_id: string | null; component_name: string | null; nature_label: string | null;
  own_engagement_ids: string[] | null; block_state: string | null; operational: boolean | null;
  other_block_id: string | null; other_class_id: string | null; overlap_starts_at: string | null; overlap_ends_at: string | null;
  operational_block_count: number | null; unavailable_block_count: number | null; week_minutes: number | null; conflict_count: number | null;
};

export class PersonScheduleShapeError extends Error {}
const hm = (t: string | null) => (t ?? "").slice(0, 5);
function closed<T extends string>(set: readonly T[], v: string | null, what: string): T {
  if (v && (set as readonly string[]).includes(v)) return v as T;
  throw new PersonScheduleShapeError(`person-schedule:unmapped-${what}:${v ?? "null"}`);
}
const KINDS = ["access-denied", "absent", "summary", "block", "conflict", "source-unavailable"];

export function mapPersonScheduleRows(rows: RawPersonRow[], t: PersonScheduleTime): PersonSchedule {
  const base = { validOn: t.validOn, knownAt: t.knownAt };
  const bad = rows.filter((r) => !KINDS.includes(r.result_kind));
  if (bad.length) throw new PersonScheduleShapeError(`person-schedule:unmapped-result-kind:${bad.map((r) => r.result_kind).join(",")}`);
  if (rows.length === 0 || rows.some((r) => r.result_kind === "access-denied")) return { kind: "negado", ...base };
  if (rows.length === 1 && rows[0]!.result_kind === "absent") return { kind: "ausente", ...base };
  const summary = rows.filter((r) => r.result_kind === "summary");
  if (summary.length !== 1) throw new PersonScheduleShapeError("person-schedule:summary-missing");
  const s = summary[0]!;
  const seen = new Set<string>();
  const blocks: PersonBlock[] = rows.filter((r) => r.result_kind === "block").map((r) => {
    if (seen.has(r.block_id!)) throw new PersonScheduleShapeError("person-schedule:duplicated-block");
    seen.add(r.block_id!);
    const sourceState = closed(SCHEDULE_STATES, r.source_state, "source-state");
    const blockState = closed(BLOCK_STATES, r.block_state, "block-state");
    const operational = r.operational === true;
    if (operational && (sourceState !== "utilizavel" || blockState !== "utilizavel"))
      throw new PersonScheduleShapeError("person-schedule:blocked-marked-operational");
    return {
      blockId: r.block_id!, blockKey: r.block_key!, classId: r.class_id!, schoolId: r.school_id, scheduleId: r.schedule_id!,
      versionId: r.version_id!, version: r.version!, weekday: r.weekday!, startsAt: hm(r.starts_at), endsAt: hm(r.ends_at),
      minutes: r.block_minutes ?? 0, componentId: r.component_id, componentName: r.component_name, natureLabel: r.nature_label,
      ownEngagementIds: r.own_engagement_ids ?? [], sourceState, blockState, operational,
    };
  });
  const conflicts: PersonConflict[] = rows.filter((r) => r.result_kind === "conflict").map((r) => {
    if (r.source_state !== "conflito-temporal-potencial") throw new PersonScheduleShapeError(`person-schedule:unmapped-conflict:${r.source_state}`);
    return {
      blockId: r.block_id!, otherBlockId: r.other_block_id!, classId: r.class_id!, otherClassId: r.other_class_id!, weekday: r.weekday!,
      overlapStartsAt: hm(r.overlap_starts_at), overlapEndsAt: hm(r.overlap_ends_at),
    };
  });
  const unavailable = rows.filter((r) => r.result_kind === "source-unavailable").map((r) => ({
    classId: r.class_id!, state: closed(UNAVAILABLE_STATES, r.source_state, "unavailable-state"), issue: r.source_issue,
  }));
  blocks.sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt) || a.blockId.localeCompare(b.blockId));
  return {
    kind: "projetado", ...base, blocks, conflicts, unavailable,
    operationalBlockCount: s.operational_block_count ?? 0, unavailableBlockCount: s.unavailable_block_count ?? 0,
    weekMinutes: s.week_minutes ?? 0, conflictCount: s.conflict_count ?? 0,
  };
}

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcClient = { rpc: unknown };
const call = (c: RpcClient, f: string, a?: Record<string, unknown>) =>
  (c.rpc as (f: string, a?: Record<string, unknown>) => Promise<RpcResult>)(f, a);

/** Só a própria pessoa: o ID vem de current_person_id(), nunca de seleção na tela. */
export async function readMySchedule(t: PersonScheduleTime, client: RpcClient = supabase): Promise<PersonSchedule> {
  if (!t.validOn) throw new Error("person-schedule:valid-on-required");
  if (!t.knownAt) throw new Error("person-schedule:known-at-required");
  const me = await call(client, "current_person_id");
  if (me.error) throw new Error(me.error.message);
  if (!me.data) return { kind: "negado", validOn: t.validOn, knownAt: t.knownAt };
  const r = await call(client, "person_schedule_at", { _person_id: me.data, _on: t.validOn, _known_at: t.knownAt });
  if (r.error) throw new Error(r.error.message);
  return mapPersonScheduleRows((r.data ?? []) as RawPersonRow[], t);
}

/** Nomes de turma/escola por fontes canônicas autorizadas; ausência ⇒ texto neutro na tela. */
export async function readPlaceNames(classIds: string[], schoolIds: string[], validOn: string): Promise<{ classes: Map<string, string>; schools: Map<string, string> }> {
  const classes = new Map<string, string>(); const schools = new Map<string, string>();
  await Promise.all(classIds.map(async (id) => {
    const r = await supabase.rpc("class_at", { _class_id: id, _valid_on: validOn });
    const rows = (r.data ?? []) as { name: string }[];
    if (!r.error && rows.length === 1) classes.set(id, rows[0]!.name);
  }));
  if (schoolIds.length) {
    const r = await supabase.from("institutional_school_record_versions").select("school_id, official_name, version_number, valid_from")
      .in("school_id", schoolIds).lte("valid_from", validOn).order("version_number", { ascending: false });
    for (const x of r.data ?? []) if (!schools.has(x.school_id)) schools.set(x.school_id, x.official_name);
  }
  return { classes, schools };
}

export const SOURCE_STATE_TEXT: Record<ScheduleState, string> = {
  utilizavel: "Grade utilizável",
  "bloqueada:jornada-ausente": "Grade da turma sem jornada registrada — bloco não confirmado",
  "bloqueada:blocos-com-pendencia": "Grade da turma com pendência — bloco não confirmado",
  "inconsistente:sobreposicao-de-blocos": "Grade da turma com blocos simultâneos — bloco não confirmado",
};
export const UNAVAILABLE_TEXT: Record<UnavailableState, string> = {
  "turma-nao-legivel": "Sua atuação nesta turma não permite ler a grade nesta data.",
  "erro-de-leitura": "A grade desta turma não pôde ser lida com segurança; nenhum bloco foi presumido.",
};
export const CONFLICT_TEXT = "Sobreposição temporal potencial; requer validação.";
