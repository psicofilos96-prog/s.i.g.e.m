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
import type { DayResolution, DayState } from "./institutional-calendar-effects";

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
export function composedDayToResolution(d: ComposedDay, knownAt: string): DayResolution {
  const state = RESULT_STATE[d.result];
  const determined = d.result === "letivo" || d.result === "nao-letivo";
  return {
    date: d.on, knownAt, state, determined,
    calendarId: d.calendarId, versionId: d.versionId,
    homologationState: determined ? "homologada" : null,
    declarations: [], diagnostic: d.detail,
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
    return { allocation: req.allocation, days: r.days.map((d) => composedDayToResolution(d, req.knownAt)), failure: null };
  } catch (e) {
    return fill(e instanceof ComposedDaysShapeError ? "fonte-malformada" : "fonte-indisponivel", e instanceof Error ? e.message : "leitura-falhou");
  }
}

/**
 * Agregado por data sobre as alocações. Determinado só por unanimidade de efeito; calendário/versão só
 * quando também únicos (multicalendário nunca é esmagado num versionId). Ausência de alocação ⇒ sem-alocacao.
 */
export function aggregateAllocationDays(dates: readonly string[], knownAt: string, per: readonly AllocationCalendar[]): DayResolution[] {
  return dates.map((date) => {
    if (per.length === 0) return blank(date, knownAt, "sem-alocacao", "nenhuma-alocacao-na-turma-no-intervalo");
    const days = per.map((p) => p.days.find((d) => d.date === date) ?? blank(date, knownAt, "fonte-malformada", "dia-ausente"));
    const states = new Map<DayState, number>();
    for (const d of days) states.set(d.state, (states.get(d.state) ?? 0) + 1);
    if (states.size > 1) {
      const detail = [...states.entries()].sort().map(([s, n]) => `${s}:${n}`).join(",");
      return blank(date, knownAt, "alocacoes-divergentes", detail);
    }
    const first = days[0]!;
    const cals = new Set(days.map((d) => d.calendarId)); const vers = new Set(days.map((d) => d.versionId));
    return {
      ...first,
      calendarId: cals.size === 1 ? first.calendarId : null,
      versionId: vers.size === 1 ? first.versionId : null,
      diagnostic: cals.size > 1 || vers.size > 1 ? `multicalendario:${cals.size}` : first.diagnostic,
    };
  });
}

export type ComposedScope = Readonly<{ contextKey: string; allocations: readonly string[]; start: string; end: string; knownAt: string }>;
export type ComposedEntry =
  | Readonly<{ status: "carregando" }>
  | Readonly<{ status: "pronto"; aggregate: readonly DayResolution[]; perAllocation: readonly AllocationCalendar[] }>;

const scopeKey = (s: ComposedScope) => [s.contextKey, [...s.allocations].sort().join(","), s.start, s.end, s.knownAt].join("|");

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
  void Promise.all(scope.allocations.map((a) => readAllocationCalendar({ allocation: a, start: scope.start, end: scope.end, knownAt: scope.knownAt }, rpcImpl)))
    .then((perAllocation) => {
      if (currentContext !== ctx || cache.get(key) !== loading) return; // outro contexto/pedido venceu
      let dates: string[] = [];
      try { dates = datesBetween(scope.start, scope.end); } catch { dates = [scope.start]; }
      cache.set(key, { status: "pronto", perAllocation, aggregate: aggregateAllocationDays(dates, scope.knownAt, perAllocation) });
      notify();
    });
  return loading;
}

/** Contagem positiva por alocação (estudante): só com todos os dias determinados; senão null + estados. */
export function allocationSchoolDays(a: AllocationCalendar): { count: number | null; undetermined: number } {
  const und = a.days.filter((d) => !d.determined).length;
  return { count: und ? null : a.days.filter((d) => d.state === "letivo").length, undetermined: und };
}
