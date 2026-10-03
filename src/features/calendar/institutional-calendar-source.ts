/**
 * B4.6.2a — Fonte institucional do calendário: projeção tipada de `calendar_at` / `calendar_day_at` (0023).
 *
 * Contrato REAL atual: uma única linha `{ result_kind, valid_on, known_at }` e o único estado aceito é
 * `access-denied` (a autorização de consulta ainda não foi definida). Não há RPC de listagem, e esta
 * fonte não lê tabelas nem helpers privados. Ela não adapta o resultado a `NetworkCalendar` nem alimenta
 * seletor do laboratório.
 *
 * Fail-closed: lista vazia, null, linha extra, estado desconhecido, campo de conteúdo ou snapshot
 * divergente lançam `InstitutionalCalendarShapeError`. Nada vira "ausente", false, zero ou negação silenciosa.
 */
import { supabase } from "@/integrations/supabase/client";

export type CalendarSnapshot = { validOn: string; knownAt: string };
export type InstitutionalCalendarRead = { kind: "access-denied"; validOn: string; knownAt: string };

export class InstitutionalCalendarShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstitutionalCalendarShapeError";
  }
}

export const captureCalendarKnownAt = (now: () => Date = () => new Date()): string => now().toISOString();

/** Data ISO estrita (AAAA-MM-DD) e existente no calendário gregoriano. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|([+-])(\d{2})(?::?(\d{2}))?)$/;

const daysIn = (y: number, m: number) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;

/**
 * Instante ISO/PostgreSQL estrito → microssegundos UTC desde a época (BigInt), ou null se inválido.
 * Aceita "T" ou espaço, frações de 1 a 6 dígitos e offset Z/±hh/±hhmm/±hh:mm. Componentes são
 * validados ANTES de normalizar (2026-02-30 é rejeitado). 24:00:00 só vale com minutos, segundos e fração zero.
 */
export function instantMicros(v: unknown): bigint | null {
  if (typeof v !== "string") return null;
  const m = INSTANT_RE.exec(v);
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number) as [number, number, number, number, number];
  const s = m[6] === undefined ? 0 : Number(m[6]);
  const frac = m[7] ?? "";
  if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo)) return null;
  if (mi > 59 || s > 59) return null;
  if (h > 24 || (h === 24 && (mi !== 0 || s !== 0 || /[1-9]/.test(frac)))) return null;
  let offMin = 0;
  if (m[8] !== "Z") {
    const oh = Number(m[10]);
    const om = m[11] === undefined ? 0 : Number(m[11]);
    if (oh > 15 || om > 59) return null;
    offMin = (m[9] === "-" ? -1 : 1) * (oh * 60 + om);
  }
  const base = new Date(0);
  base.setUTCFullYear(y, mo - 1, d);
  base.setUTCHours(0, 0, 0, 0);
  const dayMs = BigInt(base.getTime());
  const micros = BigInt(frac.padEnd(6, "0") || "0");
  return dayMs * 1000n + BigInt(((h * 60 + mi) * 60 + s) - offMin * 60) * 1_000_000n + micros;
}

/** Instante válido com fuso explícito (componentes conferidos; precisão até microssegundos). */
export function isKnownAt(v: unknown): v is string {
  return instantMicros(v) !== null;
}

const EXPECTED_KEYS = ["known_at", "result_kind", "valid_on"];

export function mapCalendarRows(rows: unknown, expected: CalendarSnapshot): InstitutionalCalendarRead {
  if (!Array.isArray(rows)) throw new InstitutionalCalendarShapeError("calendar:response-not-a-list");
  if (rows.length !== 1) throw new InstitutionalCalendarShapeError(`calendar:expected-one-row:${rows.length}`);
  const row = rows[0] as Record<string, unknown> | null;
  if (!row || typeof row !== "object") throw new InstitutionalCalendarShapeError("calendar:row-malformed");
  const keys = Object.keys(row).sort();
  if (keys.length !== EXPECTED_KEYS.length || keys.some((k, i) => k !== EXPECTED_KEYS[i]))
    throw new InstitutionalCalendarShapeError(`calendar:unexpected-fields:${keys.join(",")}`);
  if (row["result_kind"] !== "access-denied")
    throw new InstitutionalCalendarShapeError(`calendar:unknown-state:${String(row["result_kind"])}`);
  if (!isIsoDate(row["valid_on"]) || row["valid_on"] !== expected.validOn)
    throw new InstitutionalCalendarShapeError("calendar:snapshot-valid-on-mismatch");
  const got = instantMicros(row["known_at"]);
  if (got === null || got !== instantMicros(expected.knownAt))
    throw new InstitutionalCalendarShapeError("calendar:snapshot-known-at-mismatch");
  return { kind: "access-denied", validOn: expected.validOn, knownAt: expected.knownAt };
}

function assertSnapshot(s: CalendarSnapshot) {
  if (!isIsoDate(s.validOn)) throw new InstitutionalCalendarShapeError("calendar:invalid-date-parameter");
  if (!isKnownAt(s.knownAt)) throw new InstitutionalCalendarShapeError("calendar:invalid-known-at-parameter");
}

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const defaultRpc: Rpc = (fn, args) => supabase.rpc(fn as "calendar_at", args as never);

/** Consulta de calendário. `calendarId = null` na listagem: o contrato público nega qualquer ID e não revela IDs nem contagens. */
export async function readCalendarAt(
  p: { calendarId: string | null } & CalendarSnapshot,
  rpc: Rpc = defaultRpc,
): Promise<InstitutionalCalendarRead> {
  assertSnapshot(p);
  if (p.calendarId !== null && (typeof p.calendarId !== "string" || p.calendarId.trim() === ""))
    throw new InstitutionalCalendarShapeError("calendar:invalid-calendar-id");
  const { data, error } = await rpc("calendar_at", { _calendar_id: p.calendarId, _on: p.validOn, _known_at: p.knownAt });
  if (error) throw error;
  return mapCalendarRows(data, p);
}

export async function readCalendarDayAt(
  p: { calendarId: string; date: string; knownAt: string },
  rpc: Rpc = defaultRpc,
): Promise<InstitutionalCalendarRead> {
  const snap = { validOn: p.date, knownAt: p.knownAt };
  assertSnapshot(snap);
  if (typeof p.calendarId !== "string" || p.calendarId.trim() === "")
    throw new InstitutionalCalendarShapeError("calendar:invalid-calendar-id");
  const { data, error } = await rpc("calendar_day_at", { _calendar_id: p.calendarId, _date: p.date, _known_at: p.knownAt });
  if (error) throw error;
  return mapCalendarRows(data, snap);
}

export const CALENDAR_ACCESS_DENIED_TEXT =
  "Consulta ao calendário institucional indisponível. A autorização de consulta ainda não foi definida.";

export function calendarErrorMessage(e: unknown): string {
  if (e instanceof InstitutionalCalendarShapeError)
    return "A resposta do calendário institucional veio em formato inesperado. Nada foi exibido.";
  return "Não foi possível consultar o calendário institucional agora. Nada foi exibido.";
}
