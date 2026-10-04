/**
 * B4.6.6 — Contrato `b4.6.6/1` do leitor autorizado `calendar_composed_days_at` (servidor é a fonte final).
 * O cliente só CONSOME a decisão do servidor: nunca recompõe, nunca autoriza nem oficializa nada.
 * Parsing estrito: contrato, snapshot (UM knownAt, µs preservados) e datas contíguas devem bater com o pedido;
 * `schoolDayEffect` só existe como boolean em letivo/nao-letivo; qualquer outro estado nunca vira false/zero.
 * Ainda NÃO conectado a telas (próxima etapa).
 */
import { instantMicros } from "@/lib/postgres-instant";

export const COMPOSED_DAY_RESULTS = [
  "letivo", "nao-letivo", "conflito", "efeito-nao-declarado", "efeito-nao-vinculado", "calendario-nao-homologado",
  "composicao-indeterminada", "sem-calendario-aplicavel", "exclusividade-violada", "norma-indisponivel",
  "contexto-indisponivel", "fonte-indisponivel",
] as const;
export type ComposedDayResult = (typeof COMPOSED_DAY_RESULTS)[number];

export type ComposedDay = Readonly<{
  on: string;
  result: ComposedDayResult;
  schoolDayEffect: boolean | null;
  calendarId: string | null;
  versionId: string | null;
  detail: string | null;
  raw: unknown;
}>;

export type ComposedDaysRead =
  | Readonly<{ kind: "access-denied" }>
  | Readonly<{ kind: "snapshot-invalido"; detail: string | null }>
  | Readonly<{ kind: "lido"; allocation: string; from: string; to: string; knownAt: string; days: readonly ComposedDay[] }>;

export class ComposedDaysShapeError extends Error {
  constructor(message: string) { super(message); this.name = "ComposedDaysShapeError"; }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const fail = (m: string): never => { throw new ComposedDaysShapeError(`composed-days:${m}`); };
const addDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10);
};

export function parseComposedDays(
  payload: unknown,
  expected: { allocation: string; from: string; to: string; knownAt: string },
): ComposedDaysRead {
  if (!isObj(payload) || payload["contract"] !== "b4.6.6/1") fail("contract");
  const p = payload as Record<string, unknown>;
  if (p["state"] === "access-denied") {
    if (Object.keys(p).length !== 2) fail("access-denied-with-metadata");
    return Object.freeze({ kind: "access-denied" });
  }
  if (p["state"] === "snapshot-invalido")
    return Object.freeze({ kind: "snapshot-invalido", detail: typeof p["detail"] === "string" ? p["detail"] : null });
  if (p["state"] !== "lido") fail(`unknown-state:${String(p["state"])}`);
  if (p["authorizes"] !== false || p["publishes"] !== false) fail("authority-claim");
  if (p["allocation"] !== expected.allocation) fail("allocation-mismatch");
  const s = p["snapshot"];
  if (!isObj(s) || s["from"] !== expected.from || s["to"] !== expected.to || typeof s["knownAt"] !== "string") fail("snapshot");
  const snap = s as Record<string, unknown>;
  const a = instantMicros(snap["knownAt"]); const b = instantMicros(expected.knownAt);
  if (a === null || b === null || a !== b) fail("known-at-mismatch");
  if (!Array.isArray(p["days"])) fail("days");
  let cursor = expected.from;
  const days = (p["days"] as unknown[]).map((d) => {
    if (!isObj(d) || d["on"] !== cursor) fail(`day-order:${cursor}`);
    const day = d as Record<string, unknown>;
    const result = day["result"];
    if (!COMPOSED_DAY_RESULTS.includes(result as ComposedDayResult)) fail(`unknown-result:${String(result)}`);
    const eff = day["schoolDayEffect"];
    const decided = result === "letivo" || result === "nao-letivo";
    if (decided && eff !== (result === "letivo")) fail("effect-mismatch");
    if (!decided && eff !== undefined && eff !== null) fail("effect-on-undecided");
    if (decided && (typeof day["calendarId"] !== "string" || typeof day["versionId"] !== "string")) fail("decided-without-provenance");
    cursor = addDay(cursor);
    return Object.freeze({
      on: day["on"] as string, result: result as ComposedDayResult, schoolDayEffect: decided ? (eff as boolean) : null,
      calendarId: typeof day["calendarId"] === "string" ? day["calendarId"] : null,
      versionId: typeof day["versionId"] === "string" ? day["versionId"] : null,
      detail: typeof day["detail"] === "string" ? day["detail"] : null, raw: d,
    });
  });
  if (days.length === 0 || addDay(expected.to) !== cursor) fail("days-incomplete");
  return Object.freeze({ kind: "lido", allocation: expected.allocation, from: expected.from, to: expected.to,
    knownAt: expected.knownAt, days: Object.freeze(days) });
}
