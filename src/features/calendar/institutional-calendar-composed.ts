/**
 * B4.6.7 Fatia 3 — consumo operacional da decisão FINAL do servidor (`calendar_composed_days_at`) por
 * ALOCAÇÃO canônica (logical_id), com UM knownAt por intervalo. O cliente nunca recompõe calendários,
 * nunca escolhe calendário (sem `structure.calendarId`, sem `calendars[0]`, sem dominante) e nunca autoriza.
 *
 * - Cada alocação tem o seu resultado (turma multietapa: o calendário de cada estudante é o do servidor
 *   para a SUA alocação/posição B3.3).
 * - Agregado da turma: só é determinado quando TODAS as alocações concordam no dia; discordância vira
 *   `alocacoes-divergentes` com a contagem por resultado preservada; nenhuma alocação ⇒ `sem-alocacao`
 *   (nunca 0 dias letivos).
 * - Cache por `contextKey` (userId#sessionRevision) + alocações + intervalo + knownAt; troca de contexto
 *   descarta tudo; resposta de pedido antigo nunca substitui a de pedido mais novo.
 */
import { supabase } from "@/integrations/supabase/client";
import { isKnownAt } from "@/lib/postgres-instant";
import { parseComposedDays, ComposedDaysShapeError, type ComposedDay, type ComposedDayResult } from "./calendar-composed-days-source";
import { datesBetween, CalendarRangeError } from "./institutional-calendar-days";
import type { ComposedEvidence, DayResolution, DayState } from "./institutional-calendar-effects";

/** Clone estrutural profundamente congelado (evidência validada do servidor, imune a mutação da origem). */
export function deepFrozenClone<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  const out: any = Array.isArray(v) ? v.map((x) => deepFrozenClone(x)) : Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, deepFrozenClone(x)]));
  return Object.freeze(out);
}

const normOf = (raw: unknown): { normId: string | null; normVersionId: string | null } => {
  const n = raw && typeof raw === "object" ? (raw as Record<string, unknown>)["norm"] : null;
  const o = n && typeof n === "object" ? (n as Record<string, unknown>) : {};
  return { normId: typeof o["normId"] === "string" ? o["normId"] : null, normVersionId: typeof o["versionId"] === "string" ? o["versionId"] : null };
};

/** Janela de pertença da alocação à turma, derivada da cadeia canônica (inscrição ∩ participação ∩ alocação). */
export type AllocationWindow = Readonly<{ id: string; from: string | null; until: string | null }>;
const inWindow = (w: AllocationWindow, d: string) => (!w.from || w.from <= d) && (!w.until || w.until >= d);

const RESULT_STATE: Record<ComposedDayResult, DayState> = {
  letivo: "letivo",
  "nao-letivo": "nao-letivo",
  conflito: "conflito-sem-regra",
  "efeito-nao-declarado": "efeito-nao-declarado",
  "efeito-nao-vinculado": "efeito-nao-vinculado",
  "calendario-nao-homologado": "nao-homologado",
  "composicao-indeterminada": "composicao-indeterminada",
  "sem-calendario-aplicavel": "sem-calendario-aplicavel",
  "exclusividade-violada": "exclusividade-violada",
  "norma-indisponivel": "norma-indisponivel",
  "contexto-indisponivel": "contexto-indisponivel",
  "fonte-indisponivel": "fonte-indisponivel",
};

const blank = (date: string, knownAt: string, state: DayState, diagnostic: string | null): DayResolution => ({
  date, knownAt, state, determined: false, calendarId: null, versionId: null, homologationState: null, declarations: [], diagnostic,
});

/** Dia do servidor → DayResolution. Proveniência (calendário/versão) só quando o servidor decidiu. */
export function composedDayToResolution(d: ComposedDay, knownAt: string, allocation = ""): DayResolution {
  const state = RESULT_STATE[d.result];
  const determined = d.result === "letivo" || d.result === "nao-letivo";
  const evidence: ComposedEvidence = Object.freeze({
    allocation, date: d.on, knownAt, result: d.result, calendarId: d.calendarId, versionId: d.versionId,
    ...normOf(d.raw), detail: d.detail, raw: deepFrozenClone(d.raw),
  });
  return {
    date: d.on, knownAt, state, determined,
    calendarId: d.calendarId, versionId: d.versionId,
    homologationState: determined ? "homologada" : null,
    // Declarações individuais pertencem ao servidor; a evidência bruta validada fica integralmente em `evidence`.
    declarations: [], diagnostic: d.detail, evidence: Object.freeze([evidence]),
  };
}

export type AllocationCalendar = Readonly<{ allocation: string; days: readonly DayResolution[]; failure: string | null }>;

type Rpc = (fn: "calendar_composed_days_at", args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const defaultRpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);

/** Lê UMA alocação para o intervalo, com UM knownAt. Falha nunca vira dia letivo nem zero. */
export async function readAllocationCalendar(
  req: { allocation: string; start: string; end: string; knownAt: string }, rpc: Rpc = defaultRpc,
): Promise<AllocationCalendar> {
  let dates: string[];
  try { dates = datesBetween(req.start, req.end); } catch (e) {
    return { allocation: req.allocation, days: [blank(req.start, req.knownAt, "snapshot-invalido", e instanceof CalendarRangeError ? e.message : null)], failure: "intervalo" };
  }
  const fill = (state: DayState, why: string) => ({ allocation: req.allocation, days: dates.map((d) => blank(d, req.knownAt, state, why)), failure: why });
  if (!isKnownAt(req.knownAt)) return fill("snapshot-invalido", "known-at");
  try {
    const { data, error } = await rpc("calendar_composed_days_at", { _allocation: req.allocation, _from: req.start, _to: req.end, _known_at: req.knownAt });
    if (error) return fill("fonte-indisponivel", "leitura-falhou");
    const r = parseComposedDays(data, { allocation: req.allocation, from: req.start, to: req.end, knownAt: req.knownAt });
    if (r.kind === "access-denied") return fill("acesso-negado", "access-denied");
    if (r.kind === "snapshot-invalido") return fill("snapshot-invalido", r.detail ?? "snapshot-invalido");
    return { allocation: req.allocation, days: r.days.map((d) => composedDayToResolution(d, req.knownAt, req.allocation)), failure: null };
  } catch (e) {
    return fill(e instanceof ComposedDaysShapeError ? "fonte-malformada" : "fonte-indisponivel", e instanceof Error ? e.message : "leitura-falhou");
  }
}

/**
 * Agregado por data sobre as alocações ATIVAS na data (pertença derivada da cadeia canônica no mesmo
 * knownAt). Alocação comprovadamente fora da vigência é excluída daquele dia; falha/ausência dentro da
 * vigência continua bloqueando. Determinado só por unanimidade de efeito; calendário/versão só quando
 * únicos; a evidência de TODAS as alocações ativas é preservada (multicalendário nunca perde proveniência).
 */
export function aggregateAllocationDays(
  dates: readonly string[], knownAt: string, per: readonly AllocationCalendar[], windows?: readonly AllocationWindow[],
): DayResolution[] {
  const win = new Map((windows ?? []).map((w) => [w.id, w]));
  return dates.map((date) => {
    const active = per.filter((p) => { const w = win.get(p.allocation); return !w || inWindow(w, date); });
    if (active.length === 0) return blank(date, knownAt, "sem-alocacao", per.length ? "nenhuma-alocacao-vigente-na-data" : "nenhuma-alocacao-na-turma-no-intervalo");
    const days = active.map((p) => p.days.find((d) => d.date === date) ?? blank(date, knownAt, "fonte-malformada", "dia-ausente"));
    const evidence = Object.freeze(days.flatMap((d) => d.evidence ?? []));
    const states = new Map<DayState, number>();
    for (const d of days) states.set(d.state, (states.get(d.state) ?? 0) + 1);
    if (states.size > 1) {
      const detail = [...states.entries()].sort().map(([s, n]) => `${s}:${n}`).join(",");
      return { ...blank(date, knownAt, "alocacoes-divergentes", detail), evidence };
    }
    const first = days[0]!;
    const cals = new Set(days.map((d) => d.calendarId)); const vers = new Set(days.map((d) => d.versionId));
    const multi = cals.size > 1 || vers.size > 1;
    return {
      ...first,
      calendarId: cals.size === 1 ? first.calendarId : null,
      versionId: vers.size === 1 ? first.versionId : null,
      diagnostic: multi ? `multicalendario:${cals.size}` : first.diagnostic,
      evidence,
    };
  });
}

export type ComposedScope = Readonly<{ contextKey: string; allocations: readonly (string | AllocationWindow)[]; start: string; end: string; knownAt: string }>;
const asWindow = (a: string | AllocationWindow): AllocationWindow => (typeof a === "string" ? { id: a, from: null, until: null } : a);
export type ComposedEntry =
  | Readonly<{ status: "carregando" }>
  | Readonly<{ status: "pronto"; aggregate: readonly DayResolution[]; perAllocation: readonly AllocationCalendar[] }>;

const scopeKey = (s: ComposedScope) => [s.contextKey, s.allocations.map(asWindow).map((w) => `${w.id}@${w.from ?? ""}~${w.until ?? ""}`).sort().join(","), s.start, s.end, s.knownAt].join("|");

let currentContext: string | null = null;
const cache = new Map<string, ComposedEntry>();
const listeners = new Set<() => void>();
let version = 0;
const notify = () => { version += 1; for (const l of listeners) l(); };

export function subscribeComposedCalendar(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function composedCalendarVersion() { return version; }
export function resetComposedCalendar() { cache.clear(); currentContext = null; notify(); }

let rpcImpl: Rpc = defaultRpc;
/** Testes: injeta a RPC. */
export function setComposedCalendarRpc(r: Rpc | null) { rpcImpl = r ?? defaultRpc; resetComposedCalendar(); }

/**
 * Síncrono: devolve a entrada do cache e, se ausente, dispara a leitura (estado "carregando", nunca zero).
 * Troca de contextKey descarta todas as entradas do contexto anterior.
 */
export function composedCalendarFor(scope: ComposedScope): ComposedEntry {
  if (currentContext !== scope.contextKey) { cache.clear(); currentContext = scope.contextKey; }
  const key = scopeKey(scope);
  const hit = cache.get(key);
  if (hit) return hit;
  const loading: ComposedEntry = { status: "carregando" };
  cache.set(key, loading);
  const ctx = scope.contextKey;
  const windows = scope.allocations.map(asWindow);
  // Cada alocação é lida só no recorte da sua vigência (fora dela o servidor nem é consultado).
  const reads = windows.flatMap((w) => {
    const start = w.from && w.from > scope.start ? w.from : scope.start;
    const end = w.until && w.until < scope.end ? w.until : scope.end;
    return start <= end ? [readAllocationCalendar({ allocation: w.id, start, end, knownAt: scope.knownAt }, rpcImpl)] : [];
  });
  void Promise.all(reads)
    .then((perAllocation) => {
      if (currentContext !== ctx || cache.get(key) !== loading) return; // outro contexto/pedido venceu
      let dates: string[] = [];
      try { dates = datesBetween(scope.start, scope.end); } catch { dates = [scope.start]; }
      cache.set(key, { status: "pronto", perAllocation, aggregate: aggregateAllocationDays(dates, scope.knownAt, perAllocation, windows) });
      notify();
    });
  return loading;
}

/** Contagem positiva por alocação (estudante): só com todos os dias determinados; senão null + estados. */
export function allocationSchoolDays(a: AllocationCalendar): { count: number | null; undetermined: number } {
  const und = a.days.filter((d) => !d.determined).length;
  return { count: und ? null : a.days.filter((d) => d.state === "letivo").length, undetermined: und };
}
