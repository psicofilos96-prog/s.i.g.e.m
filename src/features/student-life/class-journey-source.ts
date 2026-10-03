/**
 * B4.3 — Fonte canônica da jornada recorrente da turma (somente leitura).
 *
 * Única porta TS para `class_journey_at(classId, validOn, knownAt)`. Jornada ≠ turno ≠ grade ≠
 * calendário ≠ aula ministrada. Intervalos são primitivas (dia 1–7 + início/fim) sem tipo; os
 * derivados (primeiro início, último fim, minutos) são descritivos, nunca carga horária normativa.
 * Sem fallback de laboratório: sem sessão a tela institucional nem chama esta fonte.
 * Não há writer: competência institucional para manter jornada não está definida.
 */
import { supabase } from "@/integrations/supabase/client";

export type JourneyTime = { validOn: string; knownAt: string };
export const captureJourneyKnownAt = (now: () => Date = () => new Date()): string => now().toISOString();

export type JourneyInterval = { startsAt: string; endsAt: string };
export type JourneyDay = { weekday: number; intervals: JourneyInterval[]; firstStart: string; lastEnd: string; minutes: number };
export type ClassJourney =
  | { kind: "negado"; classId: string; validOn: string; knownAt: string }
  | { kind: "ausente"; classId: string; validOn: string; knownAt: string }
  | {
      kind: "vigente"; classId: string; validOn: string; knownAt: string;
      journeyId: string; versionId: string; version: number; changeKind: string;
      validFrom: string; effectiveUntil: string | null; actRef: string; changeReason: string | null; recordedAt: string;
      days: JourneyDay[]; weekMinutes: number;
    };

export type RawJourneyRow = {
  result_kind: string; class_id: string; valid_on: string; known_at: string; journey_id: string | null; version_id: string | null;
  version: number | null; change_kind: string | null; valid_from: string | null; effective_until: string | null;
  originating_act_ref: string | null; change_reason: string | null; recorded_at: string | null;
  weekday: number | null; starts_at: string | null; ends_at: string | null; day_first_start: string | null;
  day_last_end: string | null; day_minutes: number | null; week_minutes: number | null;
};

const hm = (t: string | null) => (t ?? "").slice(0, 5);

export class JourneyShapeError extends Error {}

export function mapJourneyRows(rows: RawJourneyRow[], classId: string, t: JourneyTime): ClassJourney {
  const base = { classId, validOn: t.validOn, knownAt: t.knownAt };
  if (rows.length === 0 || rows.some((r) => r.result_kind === "access-denied")) return { kind: "negado", ...base };
  if (rows.length === 1 && rows[0]!.result_kind === "absent") return { kind: "ausente", ...base };
  const unknown = rows.filter((r) => r.result_kind !== "interval");
  if (unknown.length) throw new JourneyShapeError(`journey:unmapped-result-kind:${unknown.map((r) => r.result_kind).join(",")}`);
  const versions = new Set(rows.map((r) => r.version_id));
  if (versions.size !== 1) throw new JourneyShapeError("journey:multiple-versions-in-response");
  const f = rows[0]!;
  const byDay = new Map<number, JourneyDay>();
  for (const r of rows) {
    const wd = r.weekday!;
    const day = byDay.get(wd) ?? { weekday: wd, intervals: [], firstStart: hm(r.day_first_start), lastEnd: hm(r.day_last_end), minutes: r.day_minutes ?? 0 };
    day.intervals.push({ startsAt: hm(r.starts_at), endsAt: hm(r.ends_at) });
    byDay.set(wd, day);
  }
  const days = [...byDay.values()].sort((a, b) => a.weekday - b.weekday);
  for (const d of days) d.intervals.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return {
    kind: "vigente", ...base, journeyId: f.journey_id!, versionId: f.version_id!, version: f.version!, changeKind: f.change_kind!,
    validFrom: f.valid_from!, effectiveUntil: f.effective_until, actRef: f.originating_act_ref!, changeReason: f.change_reason,
    recordedAt: f.recorded_at!, days, weekMinutes: f.week_minutes ?? 0,
  };
}

type RpcResult = { data: unknown; error: { message: string } | null };
export async function readClassJourney(classId: string, t: JourneyTime, client = supabase): Promise<ClassJourney> {
  if (!t.validOn) throw new Error("journey:valid-on-required");
  if (!t.knownAt) throw new Error("journey:known-at-required");
  const r = await (client.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<RpcResult>)(
    "class_journey_at", { _class_id: classId, _on: t.validOn, _known_at: t.knownAt });
  if (r.error) throw new Error(r.error.message); // ambiguidade/cadeia: fail-closed, nunca ausência
  return mapJourneyRows((r.data ?? []) as RawJourneyRow[], classId, t);
}

export const WEEKDAY_LABEL: Record<number, string> = {
  1: "Segunda-feira", 2: "Terça-feira", 3: "Quarta-feira", 4: "Quinta-feira", 5: "Sexta-feira", 6: "Sábado", 7: "Domingo",
};
export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")} min` : `${h} h`;
}

const MESSAGES: Record<string, string> = {
  "journey:ambiguous-temporal-state": "Há mais de uma versão de jornada vigente nesta data; nada foi escolhido.",
  "journey:invalid-chain": "O histórico da jornada está inconsistente; a leitura foi interrompida.",
  "journey:outside-class-validity": "A jornada registrada não cabe na existência da turma nesta data.",
};
export function journeyMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  const k = Object.keys(MESSAGES).find((x) => text.includes(x));
  return k ? MESSAGES[k]! : `Leitura interrompida sem conclusão: ${text}`;
}
