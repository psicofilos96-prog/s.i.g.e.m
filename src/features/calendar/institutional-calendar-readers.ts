/**
 * B4.6.7 — Leitura positiva estrita dos leitores autorizados do calendário (contrato `b4.6.6/1`, migrations 0032–0034).
 *
 * Formas aceitas EXATAMENTE como o SQL atual devolve: `calendar_days_at`, `calendar_list_at`,
 * `calendar_day_types_at`, `calendar_composition_norm_at`. Chave desconhecida, estado desconhecido,
 * snapshot divergente (datas ou knownAt com µs) ⇒ `CalendarReaderShapeError`. Nada vira ausente/false/zero.
 *
 * `dayEffectFromRows` apresenta UM calendário (não o dia composto de um estudante) com a mesma regra do
 * servidor 0034: true×false ⇒ conflito; NULL declarado ⇒ efeito-nao-declarado; só então letivo/não-letivo.
 * Nenhum leitor autoriza, publica ou oficializa nada.
 */
import { supabase } from "@/integrations/supabase/client";
import { instantMicros, isIsoDate, isKnownAt } from "./institutional-calendar-source";

export class CalendarReaderShapeError extends Error {
  constructor(message: string) { super(message); this.name = "CalendarReaderShapeError"; }
}
const fail = (m: string): never => { throw new CalendarReaderShapeError(`calendar-reader:${m}`); };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function exactKeys(o: Record<string, unknown>, keys: readonly string[], where: string) {
  const got = Object.keys(o).sort(); const want = [...keys].sort();
  if (got.length !== want.length || got.some((k, i) => k !== want[i])) fail(`${where}:fields:${got.join(",")}`);
}
const str = (v: unknown, w: string): string => (typeof v === "string" && v !== "" ? v : fail(`${w}:string`));
const strN = (v: unknown, w: string): string | null => (v === null ? null : str(v, w));
const date = (v: unknown, w: string): string => (isIsoDate(v) ? v : fail(`${w}:date`));
const dateN = (v: unknown, w: string): string | null => (v === null ? null : date(v, w));
const int = (v: unknown, w: string): number => (Number.isInteger(v) ? (v as number) : fail(`${w}:int`));
const intN = (v: unknown, w: string): number | null => (v === null ? null : int(v, w));
const boolN = (v: unknown, w: string): boolean | null => (v === null || typeof v === "boolean" ? v : fail(`${w}:boolean-or-null`));
const instant = (v: unknown, w: string): string => (instantMicros(v) !== null ? (v as string) : fail(`${w}:instant`));
function sameInstant(got: unknown, want: string, w: string) {
  const a = instantMicros(got); if (a === null || a !== instantMicros(want)) fail(`${w}:known-at-mismatch`);
}
const deepFreeze = <T>(v: T): T => {
  if (v && typeof v === "object") { Object.values(v as object).forEach(deepFreeze); Object.freeze(v); }
  return v;
};
const addDay = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

type Denied = Readonly<{ kind: "access-denied" }>;
type Invalid = Readonly<{ kind: "snapshot-invalido"; detail: string | null }>;
function envelope(p: unknown, w: string): Denied | Invalid | Record<string, unknown> {
  if (!isObj(p) || p["contract"] !== "b4.6.6/1") fail(`${w}:contract`);
  const o = p as Record<string, unknown>;
  if (o["state"] === "access-denied") { exactKeys(o, ["contract", "state"], w); return Object.freeze({ kind: "access-denied" as const }); }
  if (o["state"] === "snapshot-invalido") {
    if ("detail" in o) exactKeys(o, ["contract", "state", "detail"], w); else exactKeys(o, ["contract", "state"], w);
    return Object.freeze({ kind: "snapshot-invalido" as const, detail: "detail" in o ? str(o["detail"], `${w}:detail`) : null });
  }
  if (o["state"] !== "lido") fail(`${w}:unknown-state:${String(o["state"])}`);
  return o;
}
const isEnvelopeResult = (v: unknown): v is Denied | Invalid => isObj(v) && typeof v["kind"] === "string";

// ---------- calendar_days_at ----------
export const DECLARATION_DAY_STATES = ["sem-versao-vigente", "referencia-b2-4-invalida", "nao-declarado", "declarado", "conflito-sem-regra", "cadeia-invalida"] as const;
export type DeclarationDayState = (typeof DECLARATION_DAY_STATES)[number];
export type DayDeclarationRow = Readonly<{
  dayState: DeclarationDayState; versionId: string | null; referenceIssue: string | null; homologationState: string | null;
  declarationKind: string | null; declarationId: string | null; startsOn: string | null; endsOn: string | null;
  eventLabel: string | null; dayTypeId: string | null; dayTypeVersionId: string | null; dayTypeVersion: number | null;
  dayTypeLabel: string | null; schoolDayEffect: boolean | null;
}>;
const ROW_KEYS = ["day_state", "version_id", "reference_issue", "homologation_state", "declaration_kind", "declaration_id", "starts_on",
  "ends_on", "event_label", "day_type_id", "day_type_version_id", "day_type_version", "day_type_label", "school_day_effect"] as const;
function parseRow(r: unknown, w: string): DayDeclarationRow {
  if (!isObj(r)) return fail(`${w}:row`);
  const st = r["day_state"];
  if (!DECLARATION_DAY_STATES.includes(st as DeclarationDayState)) fail(`${w}:day-state:${String(st)}`);
  if (st === "cadeia-invalida") {
    exactKeys(r, ["day_state"], w);
    return { dayState: "cadeia-invalida", versionId: null, referenceIssue: null, homologationState: null, declarationKind: null, declarationId: null,
      startsOn: null, endsOn: null, eventLabel: null, dayTypeId: null, dayTypeVersionId: null, dayTypeVersion: null, dayTypeLabel: null, schoolDayEffect: null };
  }
  exactKeys(r, ROW_KEYS, w);
  const row: DayDeclarationRow = {
    dayState: st as DeclarationDayState, versionId: strN(r["version_id"], w), referenceIssue: strN(r["reference_issue"], w),
    homologationState: strN(r["homologation_state"], w), declarationKind: strN(r["declaration_kind"], w),
    declarationId: strN(r["declaration_id"], w), startsOn: dateN(r["starts_on"], w), endsOn: dateN(r["ends_on"], w),
    eventLabel: strN(r["event_label"], w), dayTypeId: strN(r["day_type_id"], w), dayTypeVersionId: strN(r["day_type_version_id"], w),
    dayTypeVersion: intN(r["day_type_version"], w), dayTypeLabel: strN(r["day_type_label"], w), schoolDayEffect: boolN(r["school_day_effect"], w),
  };
  const declared = row.dayState === "declarado" || row.dayState === "conflito-sem-regra";
  if (declared !== (row.declarationId !== null)) fail(`${w}:declaration-id-vs-state`);
  if (declared && (row.dayTypeVersionId === null || row.declarationKind === null)) fail(`${w}:declaration-incomplete`);
  return row;
}

export type CalendarDayRead = Readonly<{ on: string; state: string; rows: readonly DayDeclarationRow[] | null }>;
export type CalendarDaysRead = Denied | Invalid | Readonly<{
  kind: "lido"; audience: "construcao" | "homologados"; calendarId: string; from: string; to: string; knownAt: string; days: readonly CalendarDayRead[];
}>;
const DAY_STATES = { homologados: ["homologada", "nao-homologado-na-data"], construcao: ["homologada", "nao-homologada", "revogada", "sem-estado"] } as const;

export function parseCalendarDays(p: unknown, exp: { calendarId: string; from: string; to: string; knownAt: string }): CalendarDaysRead {
  const e = envelope(p, "days"); if (isEnvelopeResult(e)) return e;
  exactKeys(e, ["contract", "state", "audience", "snapshot", "calendarId", "days"], "days");
  const aud = e["audience"]; if (aud !== "construcao" && aud !== "homologados") fail("days:audience");
  const s = e["snapshot"]; if (!isObj(s)) return fail("days:snapshot");
  exactKeys(s, ["from", "to", "knownAt"], "days:snapshot");
  if (s["from"] !== exp.from || s["to"] !== exp.to) fail("days:snapshot-dates");
  sameInstant(s["knownAt"], exp.knownAt, "days");
  if (e["calendarId"] !== exp.calendarId) fail("days:calendar-mismatch");
  if (!Array.isArray(e["days"])) fail("days:list");
  const allowed: readonly string[] = DAY_STATES[aud as "construcao" | "homologados"];
  let cursor = exp.from;
  const days = (e["days"] as unknown[]).map((d, i) => {
    if (!isObj(d)) return fail(`days:${i}`);
    if (d["on"] !== cursor) fail(`days:${i}:not-contiguous`);
    cursor = addDay(cursor);
    const st = d["state"]; if (typeof st !== "string" || !allowed.includes(st)) fail(`days:${i}:state:${String(st)}`);
    if (st === "nao-homologado-na-data") { exactKeys(d, ["on", "state"], `days:${i}`); return { on: d["on"] as string, state: st, rows: null }; }
    exactKeys(d, ["on", "state", "rows"], `days:${i}`);
    if (!Array.isArray(d["rows"]) || d["rows"].length === 0) fail(`days:${i}:rows`);
    return { on: d["on"] as string, state: st as string, rows: (d["rows"] as unknown[]).map((r, j) => parseRow(r, `days:${i}:${j}`)) };
  });
  if (days.length === 0 || days[days.length - 1]!.on !== exp.to) fail("days:range-incomplete");
  return deepFreeze({ kind: "lido", audience: aud, calendarId: exp.calendarId, from: exp.from, to: exp.to, knownAt: exp.knownAt, days });
}

export type CalendarDayEffect =
  | { kind: "letivo" } | { kind: "nao-letivo" } | { kind: "conflito" } | { kind: "efeito-nao-declarado" }
  | { kind: "nao-declarado" } | { kind: "indeterminado"; reason: string };
/** Mesma regra do servidor (0034) para UM calendário. */
export function dayEffectFromRows(day: CalendarDayRead): CalendarDayEffect {
  if (day.state !== "homologada" || !day.rows) return { kind: "indeterminado", reason: `nao-homologado:${day.state}` };
  const bad = day.rows.find((r) => r.dayState === "sem-versao-vigente" || r.dayState === "referencia-b2-4-invalida" || r.dayState === "cadeia-invalida");
  if (bad) return { kind: "indeterminado", reason: bad.dayState };
  const decl = day.rows.filter((r) => r.declarationId !== null);
  if (decl.length === 0) return { kind: "nao-declarado" };
  const t = decl.some((r) => r.schoolDayEffect === true); const f = decl.some((r) => r.schoolDayEffect === false);
  if (t && f) return { kind: "conflito" };
  if (decl.some((r) => r.schoolDayEffect === null)) return { kind: "efeito-nao-declarado" };
  return t ? { kind: "letivo" } : { kind: "nao-letivo" };
}

/** Contagem positiva: só número quando TODOS os dias têm efeito determinado; senão null com o primeiro motivo. */
export function countSchoolDaysStrict(days: readonly CalendarDayRead[]):
  { count: number; nonSchool: number; reason: null } | { count: null; nonSchool: null; reason: string } {
  let c = 0; let n = 0;
  for (const d of days) {
    const e = dayEffectFromRows(d);
    if (e.kind === "letivo") c++; else if (e.kind === "nao-letivo") n++;
    else return { count: null, nonSchool: null, reason: `${d.on}:${e.kind === "indeterminado" ? e.reason : e.kind}` };
  }
  return { count: c, nonSchool: n, reason: null };
}

// ---------- calendar_list_at ----------
export type CalendarVersionSummary = Readonly<{
  calendarId: string; versionId: string; version: number; changeKind: string; academicYearId: string; periodOrganizationId: string;
  validFrom: string; validTo: string | null; actId: string; recordedAt: string;
  lastHomologation: Readonly<{ recordId: string; sequence: number; decision: string; effectiveFrom: string; recordedAt: string }> | null;
}>;
export type CalendarListRead = Denied | Invalid | Readonly<{ kind: "lido"; audience: "construcao" | "homologados"; knownAt: string; versions: readonly CalendarVersionSummary[] }>;
export function parseCalendarList(p: unknown, exp: { knownAt: string }): CalendarListRead {
  const e = envelope(p, "list"); if (isEnvelopeResult(e)) return e;
  exactKeys(e, ["contract", "state", "audience", "knownAt", "versions"], "list");
  const aud = e["audience"]; if (aud !== "construcao" && aud !== "homologados") fail("list:audience");
  sameInstant(e["knownAt"], exp.knownAt, "list");
  if (!Array.isArray(e["versions"])) fail("list:versions");
  const versions = (e["versions"] as unknown[]).map((v, i) => {
    const w = `list:${i}`; if (!isObj(v)) return fail(w);
    exactKeys(v, ["calendarId", "versionId", "version", "changeKind", "academicYearId", "periodOrganizationId", "validFrom", "validTo", "actId", "recordedAt", "lastHomologation"], w);
    const h = v["lastHomologation"];
    let lastHomologation: CalendarVersionSummary["lastHomologation"] = null;
    if (h !== null) {
      if (!isObj(h)) return fail(`${w}:homologation`);
      exactKeys(h, ["recordId", "sequence", "decision", "effectiveFrom", "recordedAt"], `${w}:homologation`);
      if (h["decision"] !== "homologada" && h["decision"] !== "revogada") fail(`${w}:decision`);
      lastHomologation = { recordId: str(h["recordId"], w), sequence: int(h["sequence"], w), decision: h["decision"] as string,
        effectiveFrom: date(h["effectiveFrom"], w), recordedAt: instant(h["recordedAt"], w) };
      if (instantMicros(lastHomologation.recordedAt)! > instantMicros(exp.knownAt)!) fail(`${w}:homologation-after-known-at`);
    }
    if (aud === "homologados" && lastHomologation?.decision !== "homologada") fail(`${w}:non-homologated-leak`);
    const recordedAt = instant(v["recordedAt"], w);
    if (instantMicros(recordedAt)! > instantMicros(exp.knownAt)!) fail(`${w}:recorded-after-known-at`);
    return { calendarId: str(v["calendarId"], w), versionId: str(v["versionId"], w), version: int(v["version"], w), changeKind: str(v["changeKind"], w),
      academicYearId: str(v["academicYearId"], w), periodOrganizationId: str(v["periodOrganizationId"], w), validFrom: date(v["validFrom"], w),
      validTo: dateN(v["validTo"], w), actId: str(v["actId"], w), recordedAt, lastHomologation };
  });
  return deepFreeze({ kind: "lido", audience: aud, knownAt: exp.knownAt, versions });
}

// ---------- calendar_day_types_at ----------
export type DayTypeVersion = Readonly<{ dayTypeId: string; versionId: string; version: number; changeKind: string; label: string; schoolDayEffect: boolean | null; actId: string; recordedAt: string }>;
export type DayTypesRead = Denied | Invalid | Readonly<{ kind: "lido"; knownAt: string; versions: readonly DayTypeVersion[] }>;
export function parseDayTypes(p: unknown, exp: { knownAt: string }): DayTypesRead {
  const e = envelope(p, "types"); if (isEnvelopeResult(e)) return e;
  exactKeys(e, ["contract", "state", "knownAt", "versions"], "types");
  sameInstant(e["knownAt"], exp.knownAt, "types");
  if (!Array.isArray(e["versions"])) fail("types:versions");
  const versions = (e["versions"] as unknown[]).map((v, i) => {
    const w = `types:${i}`; if (!isObj(v)) return fail(w);
    exactKeys(v, ["dayTypeId", "versionId", "version", "changeKind", "label", "schoolDayEffect", "actId", "recordedAt"], w);
    return { dayTypeId: str(v["dayTypeId"], w), versionId: str(v["versionId"], w), version: int(v["version"], w), changeKind: str(v["changeKind"], w),
      label: str(v["label"], w), schoolDayEffect: boolN(v["schoolDayEffect"], w), actId: str(v["actId"], w), recordedAt: instant(v["recordedAt"], w) };
  });
  return deepFreeze({ kind: "lido", knownAt: exp.knownAt, versions });
}

// ---------- calendar_composition_norm_at ----------
export type NormVersionView = Readonly<{
  normId: string; versionId: string; state: string; detail: string | null; version: number; validFrom: string; validTo: string | null; actId: string;
  multiplicity: string | null; dimensionRules: readonly Readonly<{ dimensionId: string; operation: string; onAbsence: string }>[];
  effectBindings: readonly Readonly<{ dimensionId: string; effectPrimitive: string; effectContractVersion: number }>[]; lastHomologationId: string | null;
}>;
export type NormRead = Denied | Invalid | Readonly<{ kind: "lido"; audience: "norma" | "homologados"; on: string; knownAt: string; finalState: string | null; versions: readonly NormVersionView[] }>;
export function parseNorm(p: unknown, exp: { on: string; knownAt: string }): NormRead {
  const e = envelope(p, "norm"); if (isEnvelopeResult(e)) return e;
  exactKeys(e, ["contract", "state", "audience", "snapshot", "finalState", "versions"], "norm");
  const aud = e["audience"]; if (aud !== "norma" && aud !== "homologados") fail("norm:audience");
  const s = e["snapshot"]; if (!isObj(s)) return fail("norm:snapshot");
  exactKeys(s, ["on", "knownAt"], "norm:snapshot");
  if (s["on"] !== exp.on) fail("norm:snapshot-on"); sameInstant(s["knownAt"], exp.knownAt, "norm");
  const finalState = strN(e["finalState"], "norm:final");
  if (aud === "homologados" && finalState !== "norma-homologada") fail("norm:non-homologated-leak");
  if (!Array.isArray(e["versions"])) fail("norm:versions");
  const versions = (e["versions"] as unknown[]).map((v, i) => {
    const w = `norm:${i}`; if (!isObj(v)) return fail(w);
    exactKeys(v, ["normId", "versionId", "state", "detail", "version", "validFrom", "validTo", "actId", "multiplicity", "dimensionRules", "effectBindings", "lastHomologationId"], w);
    if (aud === "homologados" && v["state"] !== "homologada") fail(`${w}:non-homologated-leak`);
    if (!Array.isArray(v["dimensionRules"]) || !Array.isArray(v["effectBindings"])) fail(`${w}:children`);
    return {
      normId: str(v["normId"], w), versionId: str(v["versionId"], w), state: str(v["state"], w), detail: strN(v["detail"], w), version: int(v["version"], w),
      validFrom: date(v["validFrom"], w), validTo: dateN(v["validTo"], w), actId: str(v["actId"], w), multiplicity: strN(v["multiplicity"], w),
      dimensionRules: (v["dimensionRules"] as unknown[]).map((d) => {
        if (!isObj(d)) return fail(`${w}:rule`); exactKeys(d, ["dimensionId", "operation", "onAbsence"], `${w}:rule`);
        return { dimensionId: str(d["dimensionId"], w), operation: str(d["operation"], w), onAbsence: str(d["onAbsence"], w) };
      }),
      effectBindings: (v["effectBindings"] as unknown[]).map((d) => {
        if (!isObj(d)) return fail(`${w}:binding`); exactKeys(d, ["dimensionId", "effectPrimitive", "effectContractVersion"], `${w}:binding`);
        return { dimensionId: str(d["dimensionId"], w), effectPrimitive: str(d["effectPrimitive"], w), effectContractVersion: int(d["effectContractVersion"], w) };
      }),
      lastHomologationId: strN(v["lastHomologationId"], w),
    };
  });
  return deepFreeze({ kind: "lido", audience: aud, on: exp.on, knownAt: exp.knownAt, finalState, versions });
}

// ---------- chamadas ----------
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const defaultRpc: Rpc = (fn, args) => supabase.rpc(fn as "calendar_list_at", args as never);
function checkKnownAt(k: string) { if (!isKnownAt(k)) fail("param:known-at"); }

export async function readCalendarList(p: { knownAt: string }, rpc: Rpc = defaultRpc) {
  checkKnownAt(p.knownAt);
  const { data, error } = await rpc("calendar_list_at", { _known_at: p.knownAt }); if (error) throw error;
  return parseCalendarList(data, p);
}
export async function readCalendarDays(p: { calendarId: string; from: string; to: string; knownAt: string }, rpc: Rpc = defaultRpc) {
  checkKnownAt(p.knownAt); if (!isIsoDate(p.from) || !isIsoDate(p.to) || p.from > p.to) fail("param:range");
  if (!p.calendarId) fail("param:calendar");
  const { data, error } = await rpc("calendar_days_at", { _calendar_id: p.calendarId, _from: p.from, _to: p.to, _known_at: p.knownAt }); if (error) throw error;
  return parseCalendarDays(data, p);
}
export async function readDayTypes(p: { knownAt: string }, rpc: Rpc = defaultRpc) {
  checkKnownAt(p.knownAt);
  const { data, error } = await rpc("calendar_day_types_at", { _known_at: p.knownAt }); if (error) throw error;
  return parseDayTypes(data, p);
}
export async function readNorm(p: { on: string; knownAt: string }, rpc: Rpc = defaultRpc) {
  checkKnownAt(p.knownAt); if (!isIsoDate(p.on)) fail("param:on");
  const { data, error } = await rpc("calendar_composition_norm_at", { _on: p.on, _known_at: p.knownAt }); if (error) throw error;
  return parseNorm(data, p);
}
