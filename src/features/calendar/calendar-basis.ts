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
import { calendarRangeExplanation, type CalendarRangeSummary } from "./institutional-calendar-days";

export type CalendarBasis = Readonly<{
  calendarId: string | null;
  knownAt: string;
  range: Readonly<{ start: string; end: string }>;
  kind: CalendarRangeSummary["kind"];
  schoolDays: number | null;
  reason: string | null;
}>;

export function calendarBasisSnapshot(
  summary: CalendarRangeSummary,
  meta: { calendarId: string | null; knownAt: string; start: string; end: string },
): CalendarBasis {
  return Object.freeze({
    calendarId: meta.calendarId,
    knownAt: meta.knownAt,
    range: Object.freeze({ start: meta.start, end: meta.end }),
    kind: summary.kind,
    schoolDays: summary.kind === "determinado" ? summary.schoolDays : null,
    reason: calendarRangeExplanation(summary),
  });
}

export type RatioResult =
  | { kind: "calculado"; value: number; basis: CalendarBasis }
  | { kind: "indisponivel"; value: null; reason: string; basis: CalendarBasis };

export function ratioOverSchoolDays(numerator: number | null, basis: CalendarBasis): RatioResult {
  if (numerator === null || !Number.isFinite(numerator))
    return { kind: "indisponivel", value: null, reason: "Numerador não informado: nada foi contado como zero.", basis };
  if (basis.schoolDays === null)
    return { kind: "indisponivel", value: null, reason: basis.reason ?? "Dias letivos não determinados.", basis };
  if (basis.schoolDays === 0)
    return { kind: "indisponivel", value: null, reason: "Nenhum dia letivo declarado no intervalo: divisão não definida.", basis };
  return { kind: "calculado", value: numerator / basis.schoolDays, basis };
}

/** Data de fato institucional: devolvida exatamente como registrada (sem ajuste por calendário). */
export function preserveFactDate(date: string): string {
  return date;
}
