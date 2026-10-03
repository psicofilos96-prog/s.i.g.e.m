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

function instant(v: string): number {
  return Date.parse(v.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2").replace(/([+-]\d{2})$/, "$1:00"));
}

/** Instante ISO com fuso explícito (Z ou ±hh:mm). */
export function isKnownAt(v: unknown): v is string {
  return typeof v === "string"
    && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}(:?\d{2})?)$/.test(v)
    && !Number.isNaN(instant(v));
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
  if (!isKnownAt(row["known_at"]) || instant(row["known_at"]) !== instant(expected.knownAt))
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
