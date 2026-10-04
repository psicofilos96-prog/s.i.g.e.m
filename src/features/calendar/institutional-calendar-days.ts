/**
 * B4.6.3b — Adaptador institucional central: fonte real (`readCalendarDayAt`) → `DayResolution`.
 *
 * - Contrato atual: `access-denied` ⇒ estado `acesso-negado` (nunca false/zero/laboratório).
 * - Sem calendarId aplicável conhecido (não há vínculo escola/oferta/alocação → calendário no esquema,
 *   D5) ⇒ `aplicabilidade-nao-declarada` SEM nenhuma RPC; nenhum ID é inferido.
 * - Intervalo limitado (MAX_CALENDAR_RANGE_DAYS) com UM knownAt; erro/forma inesperada por dia vira
 *   estado próprio. Nenhum helper privado é consultado.
 * - Proteção de sessão: o hook usa chave `contextKey` (userId#revisão) + snapshot; resposta de outro
 *   contexto nunca é exibida (query keyed + descarte por geração).
 */
import { useQuery } from "@tanstack/react-query";
import { readCalendarDayAt, InstitutionalCalendarShapeError } from "./institutional-calendar-source";
import { isKnownAt } from "@/lib/postgres-instant";
import {
  isCivilIsoDate, resolveCalendarDay, countSchoolDays, type DayResolution, type DayState,
} from "./institutional-calendar-effects";

export const MAX_CALENDAR_RANGE_DAYS = 400;

export class CalendarRangeError extends Error {}

export function datesBetween(start: string, end: string): string[] {
  if (!isCivilIsoDate(start) || !isCivilIsoDate(end) || end < start) throw new CalendarRangeError("calendar-range:invalid");
  const out: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); ; t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10);
    out.push(d);
    if (out.length > MAX_CALENDAR_RANGE_DAYS) throw new CalendarRangeError("calendar-range:too-long");
    if (d === end) break;
  }
  return out;
}

const unresolved = (date: string, knownAt: string, state: DayState, diagnostic: string | null = null): DayResolution => ({
  date, knownAt, state, determined: false, calendarId: null, versionId: null, homologationState: null, declarations: [], diagnostic,
});

export type CalendarRangeRequest = { calendarId: string | null; start: string; end: string; knownAt: string };
type Rpc = Parameters<typeof readCalendarDayAt>[1];

/** Lê o intervalo pela fonte pública. Sem calendarId ⇒ aplicabilidade não declarada, sem RPC. */
export async function readInstitutionalCalendarRange(req: CalendarRangeRequest, rpc?: Rpc): Promise<DayResolution[]> {
  if (!isKnownAt(req.knownAt)) throw new CalendarRangeError("calendar-range:invalid-known-at");
  const dates = datesBetween(req.start, req.end);
  if (req.calendarId === null) return dates.map((d) => unresolved(d, req.knownAt, "aplicabilidade-nao-declarada", "sem-vinculo-calendario-escola-oferta-alocacao"));
  const calendarId = req.calendarId;
  return Promise.all(dates.map(async (date) => {
    try {
      const r = await readCalendarDayAt({ calendarId, date, knownAt: req.knownAt }, rpc);
      // Único estado do contrato atual: access-denied.
      if (r.kind !== "access-denied") return unresolved(date, req.knownAt, "fonte-malformada", "estado-desconhecido");
      return resolveCalendarDay({ source: "acesso-negado", date, knownAt: req.knownAt }, { kind: "nao-declarada" }, null);
    } catch (e) {
      return e instanceof InstitutionalCalendarShapeError
        ? unresolved(date, req.knownAt, "fonte-malformada", e.message)
        : unresolved(date, req.knownAt, "fonte-indisponivel", "leitura-falhou");
    }
  }));
}

/** Sem calendário aplicável conhecido: síncrono, sem RPC (mesmo resultado do caminho acima). */
export function calendarRangeWithoutApplicableCalendar(start: string, end: string, knownAt: string): DayResolution[] {
  if (!isKnownAt(knownAt)) return [unresolved(start, knownAt, "snapshot-invalido")];
  try {
    return datesBetween(start, end).map((d) => unresolved(d, knownAt, "aplicabilidade-nao-declarada", "sem-vinculo-calendario-escola-oferta-alocacao"));
  } catch {
    return [unresolved(start, knownAt, "snapshot-invalido")];
  }
}

export type CalendarRangeSummary =
  | { kind: "determinado"; schoolDays: number; days: readonly DayResolution[] }
  | { kind: "indeterminado"; states: Partial<Record<DayState, number>>; days: readonly DayResolution[] };

export function summarizeCalendarRange(days: readonly DayResolution[]): CalendarRangeSummary {
  const c = countSchoolDays(days);
  if (c.count !== null) return { kind: "determinado", schoolDays: c.count, days };
  const states: Partial<Record<DayState, number>> = {};
  for (const d of c.undetermined) states[d.state] = (states[d.state] ?? 0) + 1;
  if (c.duplicatedDates.length) states["fonte-malformada"] = (states["fonte-malformada"] ?? 0) + c.duplicatedDates.length;
  return { kind: "indeterminado", states, days };
}

const STATE_TEXT: Record<DayState, string> = {
  "acesso-negado": "a consulta ao calendário institucional foi negada (autorização de leitura ainda não definida)",
  "snapshot-invalido": "a data ou o instante de consulta é inválido",
  "fonte-indisponivel": "a leitura do calendário institucional falhou",
  "fonte-malformada": "o calendário institucional respondeu em formato inesperado",
  "sem-versao-vigente": "não há versão de calendário vigente",
  "referencia-b2-4-invalida": "o calendário referencia ano/período institucional inválido",
  "nao-homologado": "o calendário não está homologado",
  revogado: "a homologação do calendário foi revogada",
  "nao-aplicavel-a-escola": "o calendário não se aplica a esta escola",
  "aplicabilidade-nao-declarada": "não há calendário institucional declarado para esta escola/oferta/turma",
  "nao-declarado": "há dias sem declaração no calendário",
  "efeito-nao-declarado": "há dias com evento sem efeito letivo declarado",
  "conflito-sem-regra": "há dias com declarações conflitantes sem regra de precedência",
  letivo: "dia letivo",
  "nao-letivo": "dia não letivo",
};

/** Explicação humana única de por que dias letivos/aulas previstas não são calculáveis. */
export function calendarRangeExplanation(s: CalendarRangeSummary): string | null {
  if (s.kind === "determinado") return null;
  const parts = Object.entries(s.states).map(([k, n]) => `${STATE_TEXT[k as DayState]} (${n} dia${n === 1 ? "" : "s"})`);
  return `Dias letivos e aulas previstas não calculáveis: ${parts.join("; ")}. Nada foi contado como zero.`;
}

/** Hook com chave de contexto de sessão: dado de outro contexto nunca aparece. */
export function useInstitutionalCalendarRange(contextKey: string, req: CalendarRangeRequest | null) {
  return useQuery({
    queryKey: ["b46-calendar-range", contextKey, req?.calendarId ?? null, req?.start, req?.end, req?.knownAt],
    enabled: Boolean(contextKey) && req !== null,
    queryFn: () => readInstitutionalCalendarRange(req!),
  });
}
