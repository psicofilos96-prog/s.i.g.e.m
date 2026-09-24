/**
 * Fonte temporal normativa para outros módulos (Diário, frequência,
 * avaliação, documentos). Só calendários HOMOLOGADOS/ARQUIVADOS respondem
 * de forma normativa; rascunhos nunca alimentam outros módulos.
 * Nenhuma regra de frequência ou avaliação é derivada daqui.
 */
import type { IsoDate } from "@/lib/academic-date";
import { demonstrationUnits as unitsData } from "@/features/units/units-data";
import {
  classesEnd,
  classesStart,
  councilDates,
  dayType,
  isSchoolDay,
  nextSchoolDay,
  periodForDate,
  resolveCalendar,
} from "./calendar-engine";
import { calendarRepository, type CalendarRepository } from "./calendar-store";
import type { CalendarModality, NetworkCalendar } from "./calendar-types";

export const isPublished = (c: NetworkCalendar) => c.status === "homologado" || c.status === "arquivado";

/** Calendário normativo da rede para (ano, modalidade). Rascunho não conta. */
export function officialCalendar(academicYearId: string, modality: CalendarModality, repo: CalendarRepository = calendarRepository) {
  const c = repo.forYear(academicYearId, modality);
  return c && isPublished(c) ? c : null;
}

/**
 * Escola → calendário: referência, nunca cópia. Todas as unidades que
 * atendem a modalidade resolvem para o MESMO calendarId.
 */
export function calendarIdForSchool(unitId: string, academicYearId: string, modality: CalendarModality, repo: CalendarRepository = calendarRepository) {
  if (!unitsData.some((u) => u.id === unitId)) return null;
  return officialCalendar(academicYearId, modality, repo)?.id ?? null;
}

export function temporalQueries(cal: NetworkCalendar) {
  const r = resolveCalendar(cal);
  return {
    calendarId: cal.id,
    dayType: (d: IsoDate) => dayType(r, d),
    isSchoolDay: (d: IsoDate) => isSchoolDay(r, d),
    isHoliday: (d: IsoDate) => dayType(r, d) === "FERIADO",
    isSchoolHoliday: (d: IsoDate) => dayType(r, d) === "FL",
    isRecess: (d: IsoDate) => dayType(r, d) === "RECESSO",
    isVacation: (d: IsoDate) => dayType(r, d) === "FERIAS",
    isWeekend: (d: IsoDate) => dayType(r, d) === "FDS",
    periodFor: (d: IsoDate) => periodForDate(cal, d),
    period: (id: string) => cal.periods.find((p) => p.id === id) ?? null,
    councils: () => councilDates(cal),
    classesStart: () => classesStart(cal),
    classesEnd: () => classesEnd(cal),
    nextSchoolDay: (d: IsoDate) => nextSchoolDay(r, d),
  };
}

/** Diário (futuro): status de uma data sem alterar regras do Diário. */
export function diaryDateStatus(cal: NetworkCalendar | null, date: IsoDate) {
  if (!cal) return "sem-calendario" as const;
  const q = temporalQueries(cal);
  const t = q.dayType(date);
  if (!t) return "fora-do-ano" as const;
  return q.isSchoolDay(date) ? ("letivo" as const) : ("nao-letivo" as const);
}
