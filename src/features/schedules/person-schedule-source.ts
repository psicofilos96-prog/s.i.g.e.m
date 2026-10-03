/**
 * B4.5 — Fonte canônica do "Meu horário": projeção pura de `person_schedule_at(personId, validOn, knownAt)`.
 *
 * pessoa → atuações vigentes → blocos B4.4 (class_schedule_at) → horários/conflitos POTENCIAIS.
 * Não persiste nada, não tem writer e só consulta a PRÓPRIA pessoa (current_person_id): visibilidade
 * gerencial de terceiros é decisão institucional aberta. Sem fixtures nem tabela antiga de slots.
 *
 * Fail-closed: o mapeador valida cada linha por result_kind (campos obrigatórios, tipos, faixas,
 * identidade temporal, coerência do resumo e dos conflitos). Dado ausente nunca vira zero; qualquer
 * forma inesperada lança PersonScheduleShapeError e nada é renderizado como horário.
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
const fail = (code: string): never => { throw new PersonScheduleShapeError(`person-schedule:${code}`); };

const KINDS = ["access-denied", "absent", "summary", "block", "conflict", "source-unavailable"] as const;
const ALL_FIELDS: (keyof RawPersonRow)[] = [
  "class_id", "school_id", "source_state", "source_issue", "schedule_id", "version_id", "version", "block_id", "block_key", "weekday",
  "starts_at", "ends_at", "block_minutes", "component_id", "component_name", "nature_label", "own_engagement_ids", "block_state",
  "operational", "other_block_id", "other_class_id", "overlap_starts_at", "overlap_ends_at",
  "operational_block_count", "unavailable_block_count", "week_minutes", "conflict_count",
];
const SUMMARY_FIELDS: (keyof RawPersonRow)[] = ["operational_block_count", "unavailable_block_count", "week_minutes", "conflict_count"];
const isNull = (v: unknown) => v === null || v === undefined;

function closed<T extends string>(set: readonly T[], v: unknown, what: string): T {
  if (typeof v === "string" && (set as readonly string[]).includes(v)) return v as T;
  return fail(`unmapped-${what}:${v ?? "null"}`);
}
function str(v: unknown, what: string): string {
  if (typeof v === "string" && v.length > 0) return v;
  return fail(`missing-${what}`);
}
function optStr(v: unknown, what: string): string | null {
  if (isNull(v)) return null;
  if (typeof v === "string" && v.length > 0) return v;
  return fail(`invalid-${what}`);
}
function nonNegInt(v: unknown, what: string): number {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return v;
  return fail(`invalid-${what}:${v ?? "null"}`);
}
/**
 * Valor TIME do PostgreSQL ("HH:MM", "HH:MM:SS", "HH:MM:SS.ffffff") → microssegundos inteiros do dia.
 * 24:00:00 só como limite legal (minuto/segundo/fração zero). Precisão preservada, sem float nem tolerância.
 */
const US_MIN = 60_000_000;
function microsOf(v: unknown, what: string): number {
  const m = typeof v === "string" ? /^(\d{2}):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,6}))?)?$/.exec(v) : null;
  if (!m) return fail(`invalid-${what}:${v ?? "null"}`);
  const h = Number(m[1]); const sec = Number(m[3] ?? "0"); const frac = Number((m[4] ?? "").padEnd(6, "0") || "0");
  if (h > 24 || (h === 24 && (m[2] !== "00" || sec !== 0 || frac !== 0))) return fail(`invalid-${what}:${v}`);
  return ((h * 60 + Number(m[2])) * 60 + sec) * 1_000_000 + frac;
}
/** Fórmula real do SQL: (extract(epoch …)/60)::integer — numeric→integer arredonda metade para longe de zero. */
export const sqlRoundedMinutes = (deltaMicros: number): number => {
  const q = Math.floor(deltaMicros / US_MIN); const r = deltaMicros - q * US_MIN;
  return q + (2 * r >= US_MIN ? 1 : 0);
};
/** Exibição: HH:MM quando segundos/fração são zero; caso contrário mostra a precisão relevante. */
export function displayTime(v: string): string {
  const [hms, frac = ""] = v.split(".");
  const f = frac.replace(/0+$/, "");
  if (f) return `${hms}.${f}`;
  return hms!.length > 5 && hms!.slice(6) !== "00" ? hms! : hms!.slice(0, 5);
}
function onlyNulls(r: RawPersonRow, allowed: (keyof RawPersonRow)[], what: string) {
  for (const f of ALL_FIELDS) if (!allowed.includes(f) && !isNull(r[f])) fail(`unexpected-field-${what}:${f}`);
}
function sameInstant(a: unknown, b: string): boolean {
  if (typeof a !== "string") return false;
  const x = Date.parse(a); const y = Date.parse(b);
  return Number.isFinite(x) && Number.isFinite(y) && x === y;
}

export function mapPersonScheduleRows(rows: unknown, t: PersonScheduleTime): PersonSchedule {
  if (!Array.isArray(rows)) return fail("payload-not-array");
  if (rows.length === 0) return fail("empty-payload");
  const base = { validOn: t.validOn, knownAt: t.knownAt };
  for (const r of rows as RawPersonRow[]) {
    if (!r || typeof r !== "object") fail("row-not-object");
    if (!(KINDS as readonly string[]).includes(r.result_kind)) fail(`unmapped-result-kind:${r.result_kind ?? "null"}`);
    if (r.valid_on !== t.validOn) fail(`valid-on-mismatch:${r.valid_on ?? "null"}`);
    if (!sameInstant(r.known_at, t.knownAt)) fail(`known-at-mismatch:${r.known_at ?? "null"}`);
  }
  const list = rows as RawPersonRow[];
  const terminal = list.filter((r) => r.result_kind === "access-denied" || r.result_kind === "absent");
  if (terminal.length > 0) {
    if (list.length !== 1) fail("terminal-row-mixed");
    const r = list[0]!;
    onlyNulls(r, [], r.result_kind);
    return { kind: r.result_kind === "access-denied" ? "negado" : "ausente", ...base };
  }

  const summaries = list.filter((r) => r.result_kind === "summary");
  if (summaries.length !== 1) fail("summary-missing-or-duplicated");
  const s = summaries[0]!;
  onlyNulls(s, SUMMARY_FIELDS, "summary");
  const operationalBlockCount = nonNegInt(s.operational_block_count, "operational-block-count");
  const unavailableBlockCount = nonNegInt(s.unavailable_block_count, "unavailable-block-count");
  const weekMinutes = nonNegInt(s.week_minutes, "week-minutes");
  const conflictCount = nonNegInt(s.conflict_count, "conflict-count");

  const blocksById = new Map<string, PersonBlock>();
  const blockRange = new Map<string, [number, number]>(); // microssegundos
  for (const r of list.filter((x) => x.result_kind === "block")) {
    for (const f of ["other_block_id", "other_class_id", "overlap_starts_at", "overlap_ends_at", "source_issue", ...SUMMARY_FIELDS] as const)
      if (!isNull(r[f])) fail(`unexpected-field-block:${f}`);
    const blockId = str(r.block_id, "block-id");
    if (blocksById.has(blockId)) fail("duplicated-block");
    const weekday = r.weekday;
    if (typeof weekday !== "number" || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) fail(`invalid-weekday:${weekday ?? "null"}`);
    const a = microsOf(r.starts_at, "starts-at"); const b = microsOf(r.ends_at, "ends-at");
    if (a >= b) fail("start-not-before-end");
    const minutes = nonNegInt(r.block_minutes, "block-minutes");
    if (minutes !== sqlRoundedMinutes(b - a)) fail("block-minutes-mismatch");
    const version = r.version;
    if (typeof version !== "number" || !Number.isInteger(version) || version < 1) fail("invalid-version");
    const engs = r.own_engagement_ids;
    if (!Array.isArray(engs) || engs.length === 0) fail("missing-own-engagements");
    if (engs!.some((e) => typeof e !== "string" || e.length === 0)) fail("invalid-own-engagement");
    if (new Set(engs).size !== engs!.length) fail("duplicated-own-engagement");
    if (typeof r.operational !== "boolean") fail("invalid-operational");
    const sourceState = closed(SCHEDULE_STATES, r.source_state, "source-state");
    const blockState = closed(BLOCK_STATES, r.block_state, "block-state");
    const shouldBeOperational = sourceState === "utilizavel" && blockState === "utilizavel";
    if (r.operational && !shouldBeOperational) fail("blocked-marked-operational");
    if (!r.operational && shouldBeOperational) fail("usable-marked-blocked");
    const componentId = optStr(r.component_id, "component-id");
    const natureLabel = optStr(r.nature_label, "nature-label");
    blocksById.set(blockId, {
      blockId, blockKey: str(r.block_key, "block-key"), classId: str(r.class_id, "class-id"), schoolId: optStr(r.school_id, "school-id"),
      scheduleId: str(r.schedule_id, "schedule-id"), versionId: str(r.version_id, "version-id"), version: version!,
      weekday: weekday!, startsAt: displayTime(r.starts_at!), endsAt: displayTime(r.ends_at!), minutes,
      componentId, componentName: optStr(r.component_name, "component-name"), natureLabel,
      ownEngagementIds: [...engs!], sourceState, blockState, operational: r.operational!,
    });
    blockRange.set(blockId, [a, b]);
  }
  const blocks = [...blocksById.values()];

  const pairs = new Set<string>();
  const conflicts: PersonConflict[] = list.filter((r) => r.result_kind === "conflict").map((r) => {
    if (r.source_state !== "conflito-temporal-potencial") fail(`unmapped-conflict:${r.source_state ?? "null"}`);
    const blockId = str(r.block_id, "conflict-block-id"); const otherBlockId = str(r.other_block_id, "conflict-other-block-id");
    if (!(blockId < otherBlockId)) fail("conflict-pair-not-canonical");
    const key = `${blockId}|${otherBlockId}`;
    if (pairs.has(key)) fail("duplicated-conflict");
    pairs.add(key);
    const x = blocksById.get(blockId); const y = blocksById.get(otherBlockId);
    if (!x || !y) fail("conflict-references-unknown-block");
    if (!x!.operational || !y!.operational) fail("conflict-with-non-operational-block");
    if (r.weekday !== x!.weekday || x!.weekday !== y!.weekday) fail("conflict-weekday-mismatch");
    if (r.class_id !== x!.classId || r.other_class_id !== y!.classId) fail("conflict-class-mismatch");
    const [xa, xb] = blockRange.get(blockId)!; const [ya, yb] = blockRange.get(otherBlockId)!;
    const os = Math.max(xa, ya); const oe = Math.min(xb, yb);
    if (!(os < oe)) fail("conflict-without-overlap");
    if (microsOf(r.overlap_starts_at, "overlap-starts-at") !== os || microsOf(r.overlap_ends_at, "overlap-ends-at") !== oe) fail("conflict-overlap-mismatch");
    return {
      blockId, otherBlockId, classId: x!.classId, otherClassId: y!.classId, weekday: x!.weekday,
      overlapStartsAt: displayTime(r.overlap_starts_at!), overlapEndsAt: displayTime(r.overlap_ends_at!),
    };
  });

  const unavailable = list.filter((r) => r.result_kind === "source-unavailable").map((r) => {
    onlyNulls(r, ["class_id", "source_state", "source_issue"], "source-unavailable");
    return { classId: str(r.class_id, "unavailable-class-id"), state: closed(UNAVAILABLE_STATES, r.source_state, "unavailable-state"), issue: optStr(r.source_issue, "source-issue") };
  });
  if (new Set(unavailable.map((u) => u.classId)).size !== unavailable.length) fail("duplicated-unavailable-source");

  const op = blocks.filter((b) => b.operational);
  if (operationalBlockCount !== op.length) fail("summary-operational-count-mismatch");
  if (unavailableBlockCount !== blocks.length - op.length) fail("summary-unavailable-count-mismatch");
  if (weekMinutes !== op.reduce((n, b) => n + b.minutes, 0)) fail("summary-week-minutes-mismatch");
  if (conflictCount !== conflicts.length) fail("summary-conflict-count-mismatch");
  if (blocks.length + unavailable.length === 0) fail("summary-without-content");

  blocks.sort((a, b) => a.weekday - b.weekday || blockRange.get(a.blockId)![0] - blockRange.get(b.blockId)![0] || a.blockId.localeCompare(b.blockId));
  return { kind: "projetado", ...base, blocks, conflicts, unavailable, operationalBlockCount, unavailableBlockCount, weekMinutes, conflictCount };
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
  return mapPersonScheduleRows(r.data, t);
}

export type PlaceNames = { classes: Map<string, string>; schools: Map<string, string>; errors: string[] };
type PlaceClient = { rpc: unknown; from: unknown };

/**
 * Nomes de turma/escola por fontes canônicas autorizadas, no MESMO snapshot (validOn, knownAt) da carga B4.5.
 * Turma: `class_at(_valid_on, _known_at)`. Escola: não há reader *_at; usa a versão de
 * `institutional_school_record_versions` com valid_from ≤ validOn E registered_at ≤ knownAt, maior version_number.
 * Limite: o registro escolar não tem retificação bitemporal além disso. Erros são devolvidos, nunca silenciados.
 */
export async function readPlaceNames(
  classIds: string[], schoolIds: string[], t: PersonScheduleTime, client: PlaceClient = supabase as unknown as PlaceClient,
): Promise<PlaceNames> {
  if (!t.validOn || !t.knownAt) throw new Error("person-schedule:names-time-required");
  const classes = new Map<string, string>(); const schools = new Map<string, string>(); const errors: string[] = [];
  await Promise.all(classIds.map(async (id) => {
    const r = await call(client, "class_at", { _class_id: id, _valid_on: t.validOn, _known_at: t.knownAt });
    if (r.error) { errors.push(`class_at:${id}:${r.error.message}`); return; }
    const rows = (r.data ?? []) as { name?: unknown }[];
    if (rows.length === 1 && typeof rows[0]!.name === "string" && rows[0]!.name) classes.set(id, rows[0]!.name);
    else if (rows.length > 1) errors.push(`class_at:${id}:ambiguous`);
  }));
  if (schoolIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await (client.from as any)("institutional_school_record_versions").select("school_id, official_name, version_number, valid_from, registered_at")
      .in("school_id", schoolIds).lte("valid_from", t.validOn).lte("registered_at", t.knownAt).order("version_number", { ascending: false });
    if (r.error) errors.push(`school_record_versions:${r.error.message}`);
    else for (const x of (r.data ?? []) as { school_id: string; official_name: string }[]) if (!schools.has(x.school_id)) schools.set(x.school_id, x.official_name);
  }
  return { classes, schools, errors };
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
