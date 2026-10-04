/**
 * B4.6.3f — contrato puro reutilizável para cálculos e documentos que dependem de dias letivos.
 *
 * - `calendarBasisSnapshot` congela a base de calendário (resumo, calendarId, knownAt) no momento da
 *   emissão: o documento cita esta base e nunca reconsulta o calendário depois.
 * - `ratioOverSchoolDays` só divide quando o denominador é determinado e > 0; caso contrário devolve
 *   `null` com o motivo — nunca zero, nunca percentual sobre denominador desconhecido.
 * - Datas de fatos (nascimento, transferência, ato, documento) são preservadas como informadas: este
 *   contrato não conhece "dia útil" nem desloca data por feriado.
 */
import { calendarRangeExplanation, datesBetween, type CalendarRangeSummary } from "./institutional-calendar-days";
import { instantMicros, isKnownAt } from "@/lib/postgres-instant";
import type { DayResolution } from "./institutional-calendar-effects";

export type CalendarBasis = Readonly<{
  calendarId: string | null;
  knownAt: string;
  range: Readonly<{ start: string; end: string }>;
  kind: CalendarRangeSummary["kind"];
  schoolDays: number | null;
  reason: string | null;
  /** Evidência por dia: versões e declarações consultadas, sem referência mutável ao produtor. */
  days: readonly Readonly<Omit<DayResolution, "declarations"> & { declarations: readonly Readonly<DayResolution["declarations"][number]>[] }>[];
}>;

export function calendarBasisSnapshot(
  summary: CalendarRangeSummary,
  meta: { calendarId: string | null; knownAt: string; start: string; end: string },
): CalendarBasis {
  let valid = isKnownAt(meta.knownAt);
  try {
    const expected = datesBetween(meta.start, meta.end);
    const actual = summary.days.map((d) => d.date);
    valid = valid && expected.length === actual.length && new Set(actual).size === actual.length
      && expected.every((date) => actual.includes(date))
      && summary.days.every((d) => isKnownAt(d.knownAt) && instantMicros(d.knownAt) === instantMicros(meta.knownAt)
        && (meta.calendarId === null || d.calendarId === meta.calendarId));
  } catch { valid = false; }
  const days = Object.freeze(summary.days.map((day) => Object.freeze({
    ...day, declarations: Object.freeze(day.declarations.map((declaration) => Object.freeze({ ...declaration }))),
    evidence: Object.freeze([...(day.evidence ?? [])]),
  })));
  return Object.freeze({
    calendarId: meta.calendarId,
    knownAt: meta.knownAt,
    range: Object.freeze({ start: meta.start, end: meta.end }),
    kind: valid ? summary.kind : "indeterminado",
    schoolDays: valid && summary.kind === "determinado" ? summary.schoolDays : null,
    reason: valid ? calendarRangeExplanation(summary) : "Base de calendário incompleta ou divergente do intervalo/instante informado.",
    days,
  });
}

type RatioBasis = { readonly kind: string; readonly schoolDays: number | null; readonly reason: string | null };
export type RatioResult<B extends RatioBasis = CalendarBasis> =
  | { kind: "calculado"; value: number; basis: B }
  | { kind: "indisponivel"; value: null; reason: string; basis: B };

/** Razão genérica por dias; não estabelece denominador nem regra de frequência escolar. */
export function ratioOverSchoolDays<B extends RatioBasis = CalendarBasis>(numerator: number | null, basis: B): RatioResult<B> {
  if (numerator === null || !Number.isFinite(numerator))
    return { kind: "indisponivel", value: null, reason: "Numerador não informado: nada foi contado como zero.", basis };
  if (basis.kind !== "determinado" || basis.schoolDays === null || !Number.isInteger(basis.schoolDays) || basis.schoolDays < 0)
    return { kind: "indisponivel", value: null, reason: basis.reason ?? "Dias letivos não determinados.", basis };
  if (basis.schoolDays === 0)
    return { kind: "indisponivel", value: null, reason: "Nenhum dia letivo declarado no intervalo: divisão não definida.", basis };
  return { kind: "calculado", value: numerator / basis.schoolDays, basis };
}

/** Data de fato institucional: devolvida exatamente como registrada (sem ajuste por calendário). */
export function preserveFactDate(date: string): string {
  return date;
}
